import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, Tabs, Form, Input, Button, message, Popconfirm } from 'antd'
import { SaveOutlined, DeleteOutlined } from '@ant-design/icons'
import { apiService } from '@/services/api'
import type { NoticeType, NoticeUpsertRequest } from '@/types/api'

const { TextArea } = Input

const NOTICE_TYPE_LABELS: Record<NoticeType, string> = {
  ORDER_FORM: '주문서 공지',
  DEPOSIT_CONFIRMATION: '입금 확인 공지',
}

const NoticeManagement = () => {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<NoticeType>('ORDER_FORM')
  const [form] = Form.useForm()

  const { data: noticesRes, isLoading } = useQuery({
    queryKey: ['admin', 'notices'],
    queryFn: () => apiService.getNotices(),
  })

  const upsertMutation = useMutation({
    mutationFn: (data: NoticeUpsertRequest) => apiService.upsertNotice(data),
    onSuccess: () => {
      message.success('공지가 저장되었습니다.')
      queryClient.invalidateQueries({ queryKey: ['admin', 'notices'] })
    },
    onError: () => message.error('저장에 실패했습니다.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (type: NoticeType) => apiService.deleteNotice(type),
    onSuccess: () => {
      message.success('공지가 삭제되었습니다.')
      queryClient.invalidateQueries({ queryKey: ['admin', 'notices'] })
      form.setFieldValue('content', '')
    },
    onError: () => message.error('삭제에 실패했습니다.'),
  })

  const notices = noticesRes?.data ?? []
  const currentNotice = notices.find((n) => n.type === activeTab)

  useEffect(() => {
    const notice = notices.find((n) => n.type === activeTab)
    form.setFieldsValue({ content: notice?.content ?? '' })
  }, [notices, activeTab])

  const handleTabChange = (key: string) => setActiveTab(key as NoticeType)

  const handleSave = () => {
    form.validateFields().then((values) => {
      upsertMutation.mutate({
        type: activeTab,
        content: values.content,
      })
    })
  }

  const handleDelete = () => {
    deleteMutation.mutate(activeTab)
  }

  return (
    <div>
      <Card title="공지사항 관리" style={{ marginBottom: 24 }}>
        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
        >
          {(['ORDER_FORM', 'DEPOSIT_CONFIRMATION'] as NoticeType[]).map((type) => (
            <Tabs.TabPane key={type} tab={NOTICE_TYPE_LABELS[type]} />
          ))}
        </Tabs>

        <Form form={form} layout="vertical">
          <Form.Item
            name="content"
            label={NOTICE_TYPE_LABELS[activeTab]}
            rules={[{ required: true, message: '공지 내용을 입력하세요.' }]}
          >
            <TextArea
              rows={8}
              placeholder="공지 내용을 입력하세요. (고객 화면에 노출됩니다)"
              disabled={isLoading}
            />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSave}
              loading={upsertMutation.isPending}
            >
              저장
            </Button>
            {currentNotice && (
              <Popconfirm
                title="이 공지를 삭제하시겠습니까?"
                onConfirm={handleDelete}
                okText="삭제"
                cancelText="취소"
              >
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  loading={deleteMutation.isPending}
                  style={{ marginLeft: 8 }}
                >
                  삭제
                </Button>
              </Popconfirm>
            )}
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}

export default NoticeManagement
