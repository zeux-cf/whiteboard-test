import { createFileRoute } from '@tanstack/react-router'
import { BoardsScreen } from '../ui/BoardsScreen'

export const Route = createFileRoute('/boards')({ component: BoardsScreen })
