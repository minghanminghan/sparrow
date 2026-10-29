export type Env = 'dev' | 'prod'

export const ENVS: Env[] = ['dev', 'prod']
export const PROD_URL = 'https://sparrow.andrewminghanjiang.com'
// Sent by `sparrow --env dev` so a dev server switched to prod still answers from the local DB.
export const ENV_HEADER = 'X-Sparrow-Env'
