import { Card,CardHeader,CardTitle,CardDescription } from "../../../../../../../components/ui/card"
import { CardContent } from "../../../../../../../components/ui/card"
import { Button } from "../../../../../../../components/ui/button"
import { RefreshCw } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../../../../../components/ui/select"
import { Repository } from "../../../../../../../components/RepoInitializeForm/index"
import { FolderOpen } from "lucide-react"
import { Lock } from "lucide-react"

export const RepoSelectionCard = ({ repositories,  selectedRepo, onRepoSelect, onInstall, onRefresh }: any) => (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <CardTitle className="text-xl font-semibold text-slate-900 dark:text-slate-100">Select Repository</CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400">
              Choose from your installed repositories
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onRefresh}>
            <RefreshCw className={`w-4 h-4`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
      <div className="space-y-4">
            <Select onValueChange={onRepoSelect} defaultValue={selectedRepo?.id?.toString()}>
              <SelectTrigger className="h-12 bg-slate-950 border-slate-200 dark:border-slate-700 focus:ring-blue-500">
                <SelectValue placeholder="Select a repository..." />
              </SelectTrigger>
              <SelectContent>
                {repositories.map((repo: Repository) => (
                  <SelectItem key={repo.id} value={repo.id.toString()}>
                    <div className="flex items-center gap-3 py-1 ">
                      {repo.private ? (
                        <Lock className="w-3 h-3 text-amber-500" />
                      ) : (
                        <FolderOpen className="w-3 h-3 text-blue-500" />
                      )}
                      <div className="flex flex-col">
                        <span className="font-medium">{repo.name}</span>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
  
            <div className="text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Missing a repository?{" "}
                <button
                  onClick={onInstall}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline font-medium"
                >
                  Install Github App
                </button>
              </p>
            </div>
          </div>
      </CardContent>
    </Card>
  )