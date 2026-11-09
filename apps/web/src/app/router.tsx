import { createBrowserRouter, Outlet } from "react-router"
import { AppShell } from "./shell/AppShell"
import { RouteErrorPage, NotFoundPage } from "./RouteFallback"
import { RequireFamily, RequireSession } from "./RouteGuards"
import { LoginPage } from "@/features/auth/LoginPage"
import { InvitePage, MorePage, OnboardingPage } from "@/features/family/FamilyPages"
import { TodayPage } from "@/features/home/TodayPage"
import { CalendarPage, CustodyPage } from "@/features/calendar/CalendarPages"
import { AgreementDetailPage, AgreementsPage, NewAgreementPage } from "@/features/proposals/AgreementsPage"
import { ExpenseDetailPage, ExpenseFormPage, MoneyPage } from "@/features/expenses/MoneyPage"
import { FeedPage } from "@/features/feed/FeedPage"
import { InboxPage } from "@/features/notifications/InboxPage"

export const router = createBrowserRouter([
  {
    element: <Outlet />,
    errorElement: <RouteErrorPage />,
    children: [
      { path: "/login", element: <LoginPage /> },
      { path: "/invite/:token", element: <InvitePage /> },
      {
        element: <RequireSession />,
        children: [
          { path: "/onboarding", element: <OnboardingPage /> },
          {
            element: <RequireFamily />,
            children: [
              {
                path: "/",
                element: <AppShell />,
                children: [
                  { index: true, element: <TodayPage /> },
                  { path: "/calendar", element: <CalendarPage /> },
                  { path: "/calendar/custody", element: <CustodyPage /> },
                  { path: "/agreements", element: <AgreementsPage /> },
                  { path: "/agreements/new", element: <NewAgreementPage /> },
                  { path: "/agreements/:id", element: <AgreementDetailPage /> },
                  { path: "/money", element: <MoneyPage /> },
                  { path: "/money/new", element: <ExpenseFormPage /> },
                  { path: "/money/:id", element: <ExpenseDetailPage /> },
                  { path: "/feed", element: <FeedPage /> },
                  { path: "/inbox", element: <InboxPage /> },
                  { path: "/more", element: <MorePage /> },
                ],
              },
            ],
          },
        ],
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
])
