import { Board } from '@/components/board/Board'
import { MobileBoard } from '@/components/mobile/MobileBoard'

export default function Home() {
  return (
    <>
      <div className="hidden h-full md:block">
        <Board />
      </div>
      <div className="h-full md:hidden">
        <MobileBoard />
      </div>
    </>
  )
}
