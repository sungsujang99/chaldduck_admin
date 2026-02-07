import { useState } from 'react'
import { Form, Input, Button, Card, message, Typography } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'

const { Title, Text } = Typography

interface LoginProps {
  onLogin: () => void
}

const Login = ({ onLogin }: LoginProps) => {
  const [loading, setLoading] = useState(false)

  const handleLogin = (values: { username: string; password: string }) => {
    setLoading(true)
    
    // 간단한 프론트엔드 인증 (admin / admin1234)
    setTimeout(() => {
      if (values.username === 'admin' && values.password === 'admin1234') {
        localStorage.setItem('chaldduck_auth', 'true')
        localStorage.setItem('chaldduck_user', 'admin')
        message.success('로그인 성공!')
        onLogin()
      } else {
        message.error('아이디 또는 비밀번호가 올바르지 않습니다.')
      }
      setLoading(false)
    }, 500)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        padding: 16,
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: 500,
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          border: 'none',
        }}
        bodyStyle={{ padding: '48px 40px' }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              fontSize: 32,
            }}
          >
            🍡
          </div>
          <Title level={3} style={{ marginBottom: 4, color: '#1a1a2e' }}>
            찰떡상회 관리자
          </Title>
          <Text type="secondary">관리자 계정으로 로그인해주세요</Text>
        </div>

        <Form
          name="login"
          onFinish={handleLogin}
          layout="vertical"
          size="large"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '아이디를 입력해주세요' }]}
          >
            <Input
              prefix={<UserOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="아이디"
              autoComplete="username"
              style={{ borderRadius: 8, height: 48 }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '비밀번호를 입력해주세요' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="비밀번호"
              autoComplete="current-password"
              style={{ borderRadius: 8, height: 48 }}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              style={{
                height: 48,
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 600,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
              }}
            >
              로그인
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}

export default Login
