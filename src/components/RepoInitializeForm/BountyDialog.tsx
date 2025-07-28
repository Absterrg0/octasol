"use client"
import { useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { format } from "date-fns"
import { CalendarIcon, GitBranch, Loader2 } from "lucide-react"

// UI Components
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { MultiSelect } from "@/components/ui/multi-select"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import RichTextEditor from "@/components/RichTextEditor"
import { Badge } from "@/components/ui/badge"

// Redux & API
import { POST } from "@/config/axios/requests"
import { clearError, setError } from "@/app/Redux/Features/error/error"

// Utils
import { cn } from "@/lib/utils"

// Types
import type { Issue } from "@/app/Redux/Features/git/issues"
import { extractTextFromHTML } from "../Bounty"

// --- Form Schema Definition ---
const bountyFormSchema = z.object({
  title: z
    .string()
    .min(5, { message: "Bounty title must be at least 5 characters." })
    .max(100, { message: "Title cannot exceed 100 characters." }),
  price: z.coerce
    .number({ required_error: "Reward amount is required." })
    .min(5, { message: "Bounty must be at least $5." }),
  description: z.string(),
  skills: z.array(z.string()).min(1, { message: "Please select at least one skill." }),
  deadline: z.date({ required_error: "A deadline is required." }),
  contact: z.string().min(3, { message: "Please provide a valid contact method." }),
})

type BountyFormData = z.infer<typeof bountyFormSchema>

const frameworksList = [
  { value: "Frontend", label: "Frontend" },
  { value: "Backend", label: "Backend" },
  { value: "Blockchain", label: "Blockchain" },
  { value: "UI/UX", label: "UI/UX" },
  { value: "Content Writing", label: "Content Writing" },
  { value: "DevOps", label: "DevOps" },
  { value: "AI/ML", label: "AI/ML" },
]

// --- Component Definition ---
interface BountyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  issue: Issue | null
}

export function BountyDialog({ open, onOpenChange, issue }: BountyDialogProps) {
  const dispatch = useDispatch()
  const user = useSelector((state: any) => state.user)
  const selectedRepo = useSelector((state:any)=>state.selectedRepo);
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<BountyFormData>({
    resolver: zodResolver(bountyFormSchema),
    mode: "onTouched",
    defaultValues: {
      title: issue?.title || "",
      price: undefined,
      description: issue?.body || "",
      skills: [],
      deadline: undefined,
      contact: "",
    },
  })

  const onSubmit = async (data: BountyFormData) => {
    if (!user || !selectedRepo || !issue) {
      dispatch(setError("User, repository, or issue data is missing."))
      return
    }

    setIsLoading(true)
    const payload = {
      ...data,
      deadline: data.deadline.toISOString(),
      issueNumber: issue.number,
      repoName: selectedRepo.full_name,
      githubId:user.githubId,
    }

    try {
      const { response, error } = await POST("/create-bounty", payload, {
        Authorization: `Bearer ${user.accessToken}`,
      })

      if (response && response.status === 200) {
        onOpenChange(false)
        dispatch(clearError())
      } else if (error) {
        dispatch(setError((error as any).message || "Failed to create bounty"))
      }
    } catch (err) {
      dispatch(setError("An unexpected error occurred."))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl w-full max-h-[95vh] p-0 border-0 rounded-2xl shadow-2xl bg-white dark:bg-neutral-950 overflow-hidden">
        {/* Fixed Header */}
        <div className="flex-shrink-0 px-8 py-6 border-b border-neutral-200 dark:border-neutral-800 bg-gradient-to-r from-slate-50 via-white to-gray-50 dark:from-neutral-900 dark:via-neutral-950 dark:to-neutral-900">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Badge
                  variant="default"
                  className="text-sm font-medium px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 rounded-full"
                >
                  Issue #{issue?.number}
                </Badge>
                <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
                  <GitBranch className="w-4 h-4" />
                  <span className="font-medium">{selectedRepo?.name}</span>
                </div>
              </div>
            </div>
            <div>
              <h2 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">Create a Bounty</h2>
              <p className="text-lg text-neutral-600 dark:text-neutral-400 leading-relaxed">
                Set up a bounty to incentivize community contributions. Define clear requirements and fair compensation.
              </p>
            </div>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden">
              <div className="grid grid-cols-1 xl:grid-cols-5 h-full gap-0">
                {/* Main Form Area - 3/5 width on xl screens */}
                <div className="xl:col-span-3 overflow-y-auto">
                  <div className="px-8 py-8 space-y-10">
                    {/* Bounty Title */}
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem className="space-y-4">
                          <FormLabel className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                            Bounty Title
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter a clear, descriptive title for your bounty"
                              {...field}
                              className="h-16 text-lg border-2 border-neutral-600 dark:border-neutral-600 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:border-blue-400 dark:focus:ring-blue-900/30 transition-all bg-neutral-900 text-neutral-100 placeholder:text-neutral-400"
                            />
                          </FormControl>
                          <FormMessage className="text-red-500" />
                        </FormItem>
                      )}
                    />

                    {/* Description */}
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem className="space-y-4">
                          <FormLabel className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                            Description & Requirements <span className="text-xs opacity-70">(Recommended 100 characters)</span>
                          </FormLabel>
                          <FormControl>
                            <div className="border-2 border-neutral-600 dark:border-neutral-600 rounded-xl overflow-hidden focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-100 dark:focus-within:border-green-400 dark:focus-within:ring-green-900/30 transition-all bg-neutral-900 min-h-[200px]">
                              <RichTextEditor content={field.value} onChange={field.onChange} />
                            </div>
                          </FormControl>
                          <FormMessage className="text-red-500" />
                        </FormItem>
                      )}
                    />

                    {/* Skills */}
                    <FormField
                      control={form.control}
                      name="skills"
                      render={({ field }) => (
                        <FormItem className="space-y-4">
                          <FormLabel className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                            Required Skills & Technologies
                          </FormLabel>
                          <FormControl>
                            <MultiSelect
                              options={frameworksList}
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              placeholder="Select the skills and technologies needed"
                              variant="inverted"
                              maxCount={5}
                              className="border-2 border-neutral-600 dark:border-neutral-600 rounded-xl focus:border-purple-500 dark:focus:border-purple-400 bg-neutral-900"
                            />
                          </FormControl>
                          <FormMessage className="text-red-500" />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Sidebar - 2/5 width on xl screens */}
                <div className="xl:col-span-2 border-t xl:border-t-0 xl:border-l border-neutral-200 dark:border-neutral-800 bg-gradient-to-b from-neutral-50 to-white dark:from-neutral-900 dark:to-neutral-950 rounded-xl">
                  <div className="h-full flex flex-col">
                    <div className="flex-1 overflow-y-auto px-8 py-8 space-y-8">
                      <FormField
                        control={form.control}
                        name="price"
                        render={({ field }) => (
                          <FormItem className="space-y-4">
                            <FormLabel className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                              Reward Amount
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  type="number"
                                  placeholder="500"
                                  {...field}
                                  min={5}
                                  step="any"
                                  className="h-16 pl-12 pr-4 text-lg font-semibold border-2 border-neutral-600 dark:border-neutral-600 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-100 dark:focus:border-green-400 dark:focus:ring-green-900/30 transition-all bg-neutral-900 text-neutral-100 placeholder:text-neutral-400"
                                />
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-300 text-xl font-bold pointer-events-none">
                                  $
                                </span>
                              </div>
                            </FormControl>
                            <FormMessage className="text-red-500" />
                          </FormItem>
                        )}
                      />

                      {/* Deadline */}
                      <FormField
                        control={form.control}
                        name="deadline"
                        render={({ field }) => (
                          <FormItem className="space-y-4">
                            <FormLabel className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                              Deadline
                            </FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    className={cn(
                                      "h-16 w-full justify-start text-left font-medium text-lg border-2 border-neutral-600 dark:border-neutral-600 rounded-xl hover:bg-neutral-700 dark:hover:bg-neutral-700 focus:border-orange-500 dark:focus:border-orange-400 focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-900/30 transition-all bg-neutral-900 text-neutral-100",
                                      !field.value && "text-neutral-400",
                                    )}
                                  >
                                    <CalendarIcon className="mr-3 h-6 w-6" />
                                    {field.value ? format(field.value, "PPP") : <span>Select deadline</span>}
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  disabled={(date) => date < new Date()}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage className="text-red-500" />
                          </FormItem>
                        )}
                      />

                      {/* Contact */}
                      <FormField
                        control={form.control}
                        name="contact"
                        render={({ field }) => (
                          <FormItem className="space-y-4">
                            <FormLabel className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                              Contact Method
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Enter your contact (e.g. Discord, email)"
                                {...field}
                                className="h-14 text-base border-2 border-neutral-600 dark:border-neutral-600 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:border-blue-400 dark:focus:ring-blue-900/30 transition-all bg-neutral-900 text-neutral-100 placeholder:text-neutral-400"
                              />
                            </FormControl>
                            <FormMessage className="text-red-500" />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Action Buttons - Fixed at bottom of sidebar */}
                    <div className="flex-shrink-0 px-8 py-6 border-t border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-sm">
                      <div className="flex gap-4">
                        <Button
                          type="submit"
                          disabled={isLoading || !form.formState.isValid}
                          className={cn(
                            "flex-1 h-14 text-lg font-semibold rounded-2xl transition-all flex items-center justify-center shadow-md",
                            form.formState.isValid
                              ? "bg-neutral-800 dark:bg-neutral-900 text-neutral-100 dark:text-neutral-50 border border-neutral-700 dark:border-neutral-800 hover:bg-green-600 dark:hover:bg-green-700 hover:border-green-500 dark:hover:border-green-600 focus:ring-4 focus:ring-green-100 dark:focus:ring-green-900"
                              : "bg-neutral-200 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 cursor-not-allowed border border-neutral-300 dark:border-neutral-700",
                          )}
                        >
                          {isLoading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                          {"Create Bounty"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => onOpenChange(false)}
                          className="flex-1 h-14 text-lg font-semibold rounded-2xl border border-red-300 dark:border-red-700 bg-white dark:bg-neutral-900 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-800 transition-all flex items-center justify-center shadow-sm hover:shadow-md focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
