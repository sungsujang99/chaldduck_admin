import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import ProductList from './pages/ProductList'
import CustomerList from './pages/CustomerList'
import CustomerProfile from './pages/CustomerProfile'
import OrdersByCustomer from './pages/OrdersByCustomer'
import OrderList from './pages/OrderList'
import OrderDetail from './pages/OrderDetail'
import PolicyManagement from './pages/PolicyManagement'

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/products" element={<ProductList />} />
          <Route path="/customers" element={<CustomerList />} />
          <Route path="/customers/:customerId/profile" element={<CustomerProfile />} />
          <Route path="/customers/:customerId/orders" element={<OrdersByCustomer />} />
          <Route path="/orders" element={<OrderList />} />
          <Route path="/orders/:orderId" element={<OrderDetail />} />
          <Route path="/policies" element={<PolicyManagement />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App
