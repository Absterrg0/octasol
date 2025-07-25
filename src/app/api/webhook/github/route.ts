import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { logToDiscord } from "@/utils/logger";
import { 
  getGithubIdbyInstallationId, 
  setUserbyInstallationId,
  getAccessToken 
} from "@/lib/apiUtils";

// Types for GitHub webhook events
interface GitHubWebhookEvent {
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
    merged: boolean;
    user: {
      id: number;
      login: string;
    };
  };
}

/**
 * Verify GitHub webhook signature
 * @param payload Raw request body
 * @param signature Signature from GitHub headers
 * @returns Boolean indicating if signature is valid
 */
function verifyGitHubSignature(payload: string, signature: string): boolean {
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    console.error("GITHUB_WEBHOOK_SECRET is not configured");
    return false;
  }

  if (!signature) {
    console.error("No signature provided in webhook");
    return false;
  }

  // Remove 'sha256=' prefix if present
  const cleanSignature = signature.replace(/^sha256=/, '');
  
  // Calculate expected signature
  const expectedSignature = createHmac('sha256', webhookSecret)
    .update(payload, 'utf8')
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  try {
    return timingSafeEqual(
      Buffer.from(cleanSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.error("Error comparing signatures:", error);
    return false;
  }
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
      number: event.pull_request.number,
      title: event.pull_request.title,
      state: event.pull_request.state,
      merged: event.pull_request.merged
    } : null
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
  if (!event.pull_request || !event.action || !event.repository) {
    return;
  }

  const { pull_request, action, repository } = event;
  
  const eventMessage = `**Pull Request ${action.toUpperCase()}**\n` +
    `Repository: ${repository.full_name}\n` +
    `PR: #${pull_request.number} - ${pull_request.title}\n` +
    `State: ${pull_request.state}\n` +
    `Merged: ${pull_request.merged}\n` +
    `User: ${pull_request.user.login}`;

  const logLevel = action === 'closed' && pull_request.merged ? "INFO" : "INFO";
  await logToDiscord(eventMessage, logLevel);
}

/**
 * Handle push events
 */
async function handlePushEvent(event: any) {
  if (!event.repository || !event.pusher) {
    return;
  }

  const { repository, pusher, commits = [] } = event;
  
  const eventMessage = `**Push Event**\n` +
    `Repository: ${repository.full_name}\n` +
    `Branch: ${event.ref?.replace('refs/heads/', '') || 'unknown'}\n` +
    `Pusher: ${pusher.name}\n` +
    `Commits: ${commits.length}`;

  await logToDiscord(eventMessage, "INFO");
}

/**
 * Main webhook handler
 */
export async function POST(req: NextRequest) {
  try {
    // Get headers
    const signature = req.headers.get('x-hub-signature-256');
    const eventType = req.headers.get('x-github-event');
    const deliveryId = req.headers.get('x-github-delivery');

    // Get raw body for signature verification
    const body = await req.text();
    
    // Verify signature
    if (!verifyGitHubSignature(body, signature || '')) {
      await logToDiscord(
        `❌ **Webhook Signature Verification Failed**\nEvent: ${eventType}\nDelivery ID: ${deliveryId}`,
        "ERROR"
      );
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // Parse JSON payload
    let event: GitHubWebhookEvent;
    try {
      event = JSON.parse(body);
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
        
      case 'push':
        await handlePushEvent(event);
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