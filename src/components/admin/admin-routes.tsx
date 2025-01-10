import { Route, Routes } from 'react-router-dom';
import { AdminSoftware } from '@/pages/admin/software';

export function AdminRoutes() {
  return (
    <Routes>
      <Route path="software" element={<AdminSoftware />} />
    </Routes>
  );
} 