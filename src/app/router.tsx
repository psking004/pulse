import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { NotFoundPage } from '@/components/shared/NotFoundPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { InvoicesPage } from '@/features/invoices/InvoicesPage';
import { InvoiceFormPage } from '@/features/invoices/InvoiceFormPage';
import { InvoiceDetailPage } from '@/features/invoices/InvoiceDetailPage';
import { InvoicePrintPage } from '@/features/invoices/InvoicePrintPage';
import { PaymentsPage } from '@/features/payments/PaymentsPage';
import { ForecastPage } from '@/features/forecast/ForecastPage';
import { CustomersPage } from '@/features/customers/CustomersPage';
import { CustomerDetailPage } from '@/features/customers/CustomerDetailPage';
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
          { path: 'invoices/new', element: <InvoiceFormPage /> },
          { path: 'invoices/:id', element: <InvoiceDetailPage /> },
          { path: 'invoices/:id/edit', element: <InvoiceFormPage /> },
          { path: 'payments', element: <PaymentsPage /> },
          { path: 'forecast', element: <ForecastPage /> },
          { path: 'customers', element: <CustomersPage /> },
          { path: 'customers/:id', element: <CustomerDetailPage /> },
          { path: 'expenses', element: <ExpensesPage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
      { path: 'invoices/:id/print', element: <InvoicePrintPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
