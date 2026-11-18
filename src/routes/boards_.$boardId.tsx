import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router'

const EditorScreen = lazyRouteComponent(() => import('../ui/EditorScreen'), 'EditorScreen')

export const Route = createFileRoute('/boards_/$boardId')({
  component: EditorRoute,
})

function EditorRoute() {
  const { boardId } = Route.useParams()
  return <EditorScreen key={boardId} boardId={boardId} />
}
