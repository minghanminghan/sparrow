import { VERSION } from '@/core/version'

export function GET(): Response {
  return Response.json({ version: VERSION })
}
