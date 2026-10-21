import { randomBytes } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { lock } from 'proper-lockfile'

export async function withLock<T>(file: string, fn: () => Promise<T> | T): Promise<T> {
  const release = await lock(file, { retries: { retries: 50, minTimeout: 20, maxTimeout: 50 }, realpath: false })
  try {
    return await fn()
  } finally {
    await release()
  }
}

export function atomicWrite(file: string, text: string): void {
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.tmp-${randomBytes(6).toString('hex')}`)
  try {
    const fd = fs.openSync(tmp, 'w')
    try {
      fs.writeSync(fd, text)
      fs.fsyncSync(fd)
    } finally {
      fs.closeSync(fd)
    }
    fs.renameSync(tmp, file)
  } catch (err) {
    fs.rmSync(tmp, { force: true })
    throw err
  }
}
