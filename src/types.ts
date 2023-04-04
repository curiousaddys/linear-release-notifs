import { z } from "zod"

export const AuthorSchema = z.object({
  email: z.string(),
  name: z.string(),
  username: z.string(),
})
export type AuthorSchema = z.infer<typeof AuthorSchema>

export const CommitSchema = z.object({
  author: AuthorSchema,
  committer: AuthorSchema,
  distinct: z.boolean(),
  id: z.string(),
  message: z.string(),
  timestamp: z.coerce.date(),
  tree_id: z.string(),
  url: z.string().url(),
})
export type CommitSchema = z.infer<typeof CommitSchema>

export const PushPayload = z.object({
  compare: z.string(),
  commits: z.array(CommitSchema),
})
