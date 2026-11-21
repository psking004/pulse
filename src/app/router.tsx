import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { NotFoundPage } from '@/components/shared/NotFoundPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { InvoicesPage } from '@/features/invoices/InvoicesPage';
import { PaymentsPage } from '@/features/payments/PaymentsPage';
import { ForecastPage } from '@/features/forecast/ForecastPage';
import { CustomersPage } from '@/features/customers/CustomersPage';
import { ExpensesPage } from '@/features/expenses/ExpensesPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { SignupPage } from '@/features/auth/SignupPage';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import { PublicOnlyRoute } from '@/features/auth/PublicOnlyRoute';

export const router = createBrowserRouter([
  {
    element: <PublicOnlyRoute />,
    children: [
      { path: 'login', element: <LoginPage /> },
      { path: 'signup', element: <SignupPage /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/',
        element: <AppShell />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'invoices', element: <InvoicesPage /> },
          { path: 'payments', element: <PaymentsPage /> },
          { path: 'forecast', element: <ForecastPage /> },
          { path: 'customers', element: <CustomersPage /> },
          { path: 'expenses', element: <ExpensesPage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
