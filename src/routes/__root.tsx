import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import font from '@fontsource-variable/inter/index.css?url'
import theme from '../ui/theme.css?url'

const loadTheme = "try{document.documentElement.dataset.theme=localStorage.getItem('whiteboard.theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}catch{}"

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'referrer', content: 'same-origin' },
      { title: 'Whiteboard' },
    ],
    links: [
      { rel: 'stylesheet', href: font },
      { rel: 'stylesheet', href: theme },
    ],
  }),
  component: RootDocument,
})

function RootDocument() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: loadTheme }} />
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  )
}
