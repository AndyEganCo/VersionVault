import { Route, Routes } from 'react-router-dom';
import { AdminSoftware } from '@/pages/admin/software';
import { AdminVersionChecks } from '@/pages/admin/version-checks';

export function AdminRoutes() {
  return (
    <Routes>
      <Route path="software" element={<AdminSoftware />} />
      <Route path="version-checks" element={<AdminVersionChecks />} />
    </Routes>
  );
} 