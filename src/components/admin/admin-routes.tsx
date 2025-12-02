import { Route, Routes } from 'react-router-dom';
import { AdminSoftware } from '@/pages/admin/software';
import { AdminExtractionTest } from '@/pages/admin/extraction-test';

export function AdminRoutes() {
  return (
    <Routes>
      <Route path="software" element={<AdminSoftware />} />
      <Route path="extraction-test" element={<AdminExtractionTest />} />
    </Routes>
  );
} 