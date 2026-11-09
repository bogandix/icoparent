import { RouterProvider } from "react-router"
import { FamilyProvider } from "@/lib/family"
import { Providers } from "./providers"
import { router } from "./router"

export function App() {
  return (
    <Providers>
      <FamilyProvider>
        <RouterProvider router={router} />
      </FamilyProvider>
    </Providers>
  )
}
