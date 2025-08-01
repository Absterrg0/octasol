import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Repository } from "../../../../../../../components/RepoInitializeForm/index"
import { Lock } from "lucide-react"
import { Star } from "lucide-react"
import { GitFork } from "lucide-react"
import { Code2 } from "lucide-react"
import { History } from "lucide-react"
import { Github } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { Badge } from "../../../../../../../components/ui/badge"
import { Button } from "../../../../../../../components/ui/button"
import { Separator } from "../../../../../../../components/ui/separator"

export const RepoDetailsCard = ({ repo }: { repo: Repository }) => (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-start gap-3">
          <div className="flex items-center gap-2">{repo.private && <Lock className="w-4 h-4" />}</div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100 truncate">
              {repo.name}
            </CardTitle>
            <CardDescription className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mt-1">
              {repo.description || "No description available"}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground flex items-center gap-2">
            <Star className="w-4 h-4" /> Stars
          </span>
          <span className="font-medium">{repo.stargazers_count.toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground flex items-center gap-2">
            <GitFork className="w-4 h-4" /> Forks
          </span>
          <span className="font-medium">{repo.forks_count.toLocaleString()}</span>
        </div>
  
        <Separator />
  
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground flex items-center gap-2">
              <Code2 className="w-4 h-4" /> Language
            </span>
            <Badge variant="default">{repo.language || "N/A"}</Badge>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground flex items-center gap-2">
              <History className="w-4 h-4" /> Last updated
            </span>
            <span className="font-medium">{formatDistanceToNow(new Date(repo.updated_at))} ago</span>
          </div>
        </div>
  
        <Button variant="outline" asChild className="w-full gap-2 bg-transparent">
          <a href={repo.html_url} target="_blank" rel="noopener noreferrer">
            <Github className="w-4 h-4 mr-2" />
            View on GitHub
          </a>
        </Button>
      </CardContent>
    </Card>
  )