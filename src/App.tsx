import { useState, useEffect } from 'react'
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
import Login from './pages/Login'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  useEffect(() => {
    // localStorage에서 인증 상태 확인
    const auth = localStorage.getItem('chaldduck_auth')
    setIsAuthenticated(auth === 'true')
  }, [])

  const handleLogin = () => {
    setIsAuthenticated(true)
  }

  const handleLogout = () => {
    localStorage.removeItem('chaldduck_auth')
    localStorage.removeItem('chaldduck_user')
    setIsAuthenticated(false)
  }

  // 로딩 상태
  if (isAuthenticated === null) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f0f2f5',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🍡</div>
          <div style={{ color: '#666' }}>로딩 중...</div>
        </div>
      </div>
    )
  }

  // 로그인 안됨
  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />
  }

  // 로그인됨
  return (
    <BrowserRouter>
      <Layout onLogout={handleLogout}>
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
