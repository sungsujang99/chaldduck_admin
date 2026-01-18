import { useState, useEffect } from 'react'
import { Layout as AntLayout, Menu, theme, Button } from 'antd'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  DashboardOutlined,
  UserOutlined,
  ShoppingCartOutlined,
  ShopOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import type { MenuProps } from 'antd'

const { Header, Sider, Content } = AntLayout

interface LayoutProps {
  children: React.ReactNode
}

const Layout = ({ children }: LayoutProps) => {
  const [collapsed, setCollapsed] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken()

  // 모바일 감지 및 사이드바 자동 접기
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (mobile) {
        setCollapsed(true)
      }
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // 모바일에서 메뉴 클릭 시 사이드바 닫기
  const handleMenuClick = ({ key }: { key: string }) => {
    if (key.startsWith('/')) {
      navigate(key)
      if (isMobile) {
        setCollapsed(true)
      }
    }
  }

  const menuItems: MenuProps['items'] = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: '대시보드',
    },
    {
      key: '/products',
      icon: <ShopOutlined />,
      label: '판매 관리',
    },
    {
      key: '/customers',
      icon: <UserOutlined />,
      label: '고객 관리',
    },
    {
      key: '/orders',
      icon: <ShoppingCartOutlined />,
      label: '주문 관리',
    },
    {
      key: '/policies',
      icon: <SettingOutlined />,
      label: '정책 관리',
    },
  ]

  const getSelectedKeys = () => {
    const path = location.pathname
    if (path === '/') return ['/']
    if (path.startsWith('/products')) return ['/products']
    if (path.startsWith('/customers')) return ['/customers']
    if (path.startsWith('/orders')) return ['/orders']
    if (path.startsWith('/policies')) return ['/policies']
    return []
  }

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={250}
        breakpoint="lg"
        collapsedWidth={isMobile ? 0 : 80}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: isMobile ? 'fixed' : 'relative',
          left: isMobile && collapsed ? '-250px' : 0,
          top: 0,
          bottom: 0,
          zIndex: 1000,
          transition: 'all 0.2s',
        }}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: collapsed ? 16 : 20,
            fontWeight: 'bold',
            borderBottom: '1px solid #303030',
          }}
        >
          {collapsed ? 'C' : 'Chaldduck Admin'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={getSelectedKeys()}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      {isMobile && !collapsed && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            zIndex: 999,
          }}
          onClick={() => setCollapsed(true)}
        />
      )}
      <AntLayout>
        <Header
          style={{
            padding: isMobile ? '0 16px' : '0 24px',
            background: colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 100,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ fontSize: 16 }}
            />
            <span style={{ fontSize: isMobile ? 16 : 18, fontWeight: 600 }}>
              관리자 대시보드
            </span>
          </div>
        </Header>
        <Content
          style={{
            margin: isMobile ? '16px 8px' : '24px 16px',
            padding: isMobile ? 16 : 24,
            minHeight: 280,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
          }}
        >
          {children}
        </Content>
      </AntLayout>
    </AntLayout>
  )
}

export default Layout
