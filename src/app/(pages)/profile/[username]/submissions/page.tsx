'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { GET } from '@/config/axios/requests'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import clsx from 'clsx'

type SubmissionItem = {
  id: number
  status: number
  links: string[]
  githubPRNumber?: number | null
  createdAt: string
  updatedAt: string
  bounty?: {
    repoName?: string | null
    issueNumber?: number | null
    bountyname?: string | null
    price?: number | null
    transactionHash?: string | null
  } | null
}

const statusMeta: Record<number, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }> = {
  0: { label: 'Draft', variant: 'secondary', className: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  1: { label: 'Submitted', variant: 'default', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  2: { label: 'Accepted', variant: 'default', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  3: { label: 'Rejected', variant: 'destructive', className: '' },
  4: { label: 'Paid Out', variant: 'default', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
}

function formatDate(dateString?: string) {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function truncateHash(hash?: string | null) {
  if (!hash) return '-'
  if (hash.length <= 12) return hash
  return `${hash.slice(0, 8)}...${hash.slice(-8)}`
}

function explorerUrl(signature?: string | null) {
  if (!signature) return undefined
  return `https://explorer.solana.com/tx/${signature}?cluster=${process.env.NEXT_PUBLIC_SOLANA_CLUSTER}`
}

export default function UserSubmissionsPage() {
  const user = useSelector((state: any) => state.user)
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([])
  const [loading, setLoading] = useState(false)

  const fetchSubmissions = async () => {
    if (!user?.accessToken) return
    setLoading(true)
    try {
      const data = await GET('/usersubmissions', {
        Authorization: `Bearer ${user.accessToken}`,
      })
      setSubmissions(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('Failed to fetch submissions', e)
      setSubmissions([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSubmissions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.accessToken])

  const rows = useMemo(() => submissions, [submissions])

  return (
    <div className="mt-8 px-4">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl">My Submissions</CardTitle>
              <CardDescription>All pull requests you submitted for bounties</CardDescription>
            </div>
            <Button variant="outline" size="icon" onClick={fetchSubmissions} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table className="min-w-[1060px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[320px]">Repository / Issue</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="w-[120px]">Amount</TableHead>
                  <TableHead className="w-[130px]">Created</TableHead>
                  <TableHead className="w-[130px]">Updated</TableHead>
                  <TableHead className="w-[220px]">Transaction</TableHead>
                  <TableHead className="text-right w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                      Loading submissions...
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                      No submissions found.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((s) => {
                    const repo = s?.bounty?.repoName || '-'
                    const issueNumber = s?.bounty?.issueNumber
                    const issueUrl = repo && typeof issueNumber === 'number' ? `https://github.com/${repo}/issues/${issueNumber}` : undefined
                    const meta = statusMeta[s.status] || { label: 'Unknown', variant: 'outline' as const }
                    const amount = typeof s?.bounty?.price === 'number' ? `$${s.bounty!.price}` : '-'
                    const tx = s.status === 4 ? s?.bounty?.transactionHash : undefined
                    const txUrl = explorerUrl(tx)
                    const txLabel = truncateHash(tx)

                    return (
                      <TableRow key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{repo}</span>
                            {typeof issueNumber === 'number' ? (
                              <a
                                href={issueUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                              >
                                Issue #{issueNumber}
                              </a>
                            ) : (
                              <span className="text-xs text-slate-500">Issue -</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={clsx(meta.className)}>{meta.label}</Badge>
                        </TableCell>
                        <TableCell>{amount}</TableCell>
                        <TableCell>{formatDate(s.createdAt)}</TableCell>
                        <TableCell>{formatDate(s.updatedAt)}</TableCell>
                        <TableCell>
                          {txUrl ? (
                            <a href={txUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-blue-600 dark:text-blue-400 hover:underline">
                              {txLabel}
                            </a>
                          ) : (
                            <span className="font-mono text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {issueUrl ? (
                            <Button asChild size="sm" variant="outline">
                              <a href={issueUrl} target="_blank" rel="noopener noreferrer">
                                View Issue
                              </a>
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" disabled>
                              N/A
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


