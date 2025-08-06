import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { logToDiscord } from "@/utils/logger";
import { 
  getGithubIdbyInstallationId, 
  setUserbyInstallationId,
  getAccessToken 
} from "@/lib/apiUtils";
import { checkPRforLinkedIssue, releasePayment } from "./util";

// Types for GitHub webhook events
export interface GitHubWebhookEvent {
  action?: string;
  installation?: {
    id: number;
    account: {
      id: number;
      login: string;
    };
  };
  sender?: {
    id: number;
    login: string;
  };
  repository?: {
    id: number;
    name: string;
    full_name: string;
  };
  issue?: {
    id: number;
    number: number;
    title: string;
    state: string;
    user: {
      id: number;
      login: string;
    };
  };
  pull_request?: {
    id: number;
    number: number;
    title: string;
    state: string;
    body: string;
    merged: boolean;
    user: {
      id: number;
      login: string;
    };
  };
}


/**
 * Get installation information from webhook payload
 */
async function getInstallationInfo(event: GitHubWebhookEvent) {
  if (!event.installation) {
    return null;
  }

  const installationId = event.installation.id;
  const githubId = await getGithubIdbyInstallationId(installationId);
  
  return {
    installationId,
    githubId,
    account: event.installation.account
  };
}

/**
 * Log webhook event details
 */
async function logWebhookEvent(
  eventType: string, 
  event: GitHubWebhookEvent, 
  installationInfo: any
) {
  const logData = {
    eventType,
    action: event.action,
    installation: installationInfo,
    repository: event.repository ? {
      id: event.repository.id,
      name: event.repository.name,
      full_name: event.repository.full_name
    } : null,
    sender: event.sender ? {
      id: event.sender.id,
      login: event.sender.login
    } : null,
    issue: event.issue ? {
      id: event.issue.id,
      number: event.issue.number,
      title: event.issue.title,
      state: event.issue.state
    } : null,
    pull_request: event.pull_request ? {
      id: event.pull_request.id,
      body:event.pull_request.body,
      number: event.pull_request.number,
      title: event.pull_request.title,
      state: event.pull_request.state,
      merged: event.pull_request.merged
    } : null,
  
  };

  await logToDiscord(
    `**GitHub Webhook Event**\n\`\`\`json\n${JSON.stringify(logData, null, 2)}\n\`\`\``,
    "INFO"
  );

  // Also log to console for development
  console.log("GitHub Webhook Event:", JSON.stringify(logData, null, 2));
}

/**
 * Handle installation events (app installed/uninstalled)
 */
async function handleInstallationEvent(event: GitHubWebhookEvent) {
  if (!event.installation || !event.action) {
    return;
  }

  const { installation, action } = event;
  
  switch (action) {
    case 'created':
      await logToDiscord(
        `🎉 **GitHub App Installed**\nAccount: ${installation.account.login} (ID: ${installation.account.id})\nInstallation ID: ${installation.id}`,
        "INFO"
      );
      
      // Set up user in database
      await setUserbyInstallationId(installation.id);
      break;
      
    case 'deleted':
      await logToDiscord(
        `🗑️ **GitHub App Uninstalled**\nAccount: ${installation.account.login} (ID: ${installation.account.id})\nInstallation ID: ${installation.id}`,
        "WARN"
      );
      break;
      
    case 'suspend':
      await logToDiscord(
        `⏸️ **GitHub App Suspended**\nAccount: ${installation.account.login} (ID: ${installation.account.id})\nInstallation ID: ${installation.id}`,
        "WARN"
      );
      break;
      
    case 'unsuspend':
      await logToDiscord(
        `▶️ **GitHub App Unsuspended**\nAccount: ${installation.account.login} (ID: ${installation.account.id})\nInstallation ID: ${installation.id}`,
        "INFO"
      );
      break;
  }
}

/**
 * Handle issue events
 */
async function handleIssueEvent(event: GitHubWebhookEvent) {
  if (!event.issue || !event.action || !event.repository) {
    return;
  }

  const { issue, action, repository } = event;
  
  const eventMessage = `**Issue ${action.toUpperCase()}**\n` +
    `Repository: ${repository.full_name}\n` +
    `Issue: #${issue.number} - ${issue.title}\n` +
    `State: ${issue.state}\n` +
    `User: ${issue.user.login}`;

  await logToDiscord(eventMessage, "INFO");
}

/**
 * Handle pull request events
 */
async function handlePullRequestEvent(event: GitHubWebhookEvent) {
  if (!event.pull_request || !event.action || !event.repository || !event.installation) {
    return;
  }



  const { pull_request, action, repository,installation } = event;
  
  const eventMessage = `**Pull Request ${action.toUpperCase()}**\n` +
    `Repository: ${repository.full_name}\n` +
    `PR: #${pull_request.number} - ${pull_request.title}\n` +
    `State: ${pull_request.state}\n` +
    `Merged: ${pull_request.merged}\n` +
    `User: ${pull_request.user.login}`;

  switch(action){
    case "opened":
      await checkPRforLinkedIssue(pull_request.body,repository.full_name,installation?.id,pull_request.number,pull_request.user.id);
      break;
    case "reopened":
      await checkPRforLinkedIssue(pull_request.body,repository.full_name,installation?.id,pull_request.number,pull_request.user.id);
      break;
    case "closed":
      if(pull_request.merged === true){
        await releasePayment(repository.full_name,pull_request.number,installation?.id);
      }
      else{
        console.log("PR Closed successfully");
      }
      break;
    default:
  }



  const logLevel = action === 'closed' && pull_request.merged ? "INFO" : "INFO";
  await logToDiscord(eventMessage, logLevel);
}

/**
 * Main webhook handler
 */
export async function POST(req: NextRequest) {
  try {
    // Get headers
    const eventType = req.headers.get('x-github-event');
    const deliveryId = req.headers.get('x-github-delivery');

    let event:GitHubWebhookEvent;    
    try {
          event = await req.json();

    } catch (error) {
      await logToDiscord(
        `❌ **Invalid JSON payload**\nEvent: ${eventType}\nError: ${(error as Error).message}`,
        "ERROR"
      );
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    // Get installation information
    const installationInfo = await getInstallationInfo(event);

    // Log the event
    await logWebhookEvent(eventType || 'unknown', event, installationInfo);

    // Handle specific event types
    switch (eventType) {
      case 'installation':
        await handleInstallationEvent(event);
        break;
        
      case 'installation_repositories':
        await logToDiscord(
          `📁 **Installation Repositories ${event.action}**\nInstallation ID: ${event.installation?.id}`,
          "INFO"
        );
        break;
        
      case 'issues':
        await handleIssueEvent(event);
        break;
        
      case 'pull_request':
        await handlePullRequestEvent(event);
        break;
        
      
      case 'ping':
        await logToDiscord(
          `🏓 **Webhook Ping Received**\nZen: ${(event as any).zen || 'N/A'}`,
          "INFO"
        );
        break;
        
      default:
        await logToDiscord(
          `📋 **Unhandled Event Type: ${eventType}**\nAction: ${event.action || 'N/A'}`,
          "INFO"
        );
    }

    return NextResponse.json({ 
      success: true, 
      eventType,
      deliveryId,
      message: "Webhook processed successfully" 
    });

  } catch (error) {
    await logToDiscord(
      `❌ **Webhook Processing Error**\nError: ${(error as Error).message}\nStack: ${(error as Error).stack}`,
      "ERROR"
    );
    
    console.error("Webhook processing error:", error);
    
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Handle GET requests (for webhook URL verification)
 */
export async function GET(req: NextRequest) {
  return NextResponse.json({
    message: "GitHub webhook endpoint is active",
    timestamp: new Date().toISOString()
  });
} 