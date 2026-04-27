import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, Table, Select, Space, Tag, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { apiService } from '@/services/api'
import type { NotificationTemplateCode, NotificationStatus } from '@/types/api'

const TEMPLATE_LABELS: Record<NotificationTemplateCode, string> = {
  ORDER_CREATED: '주문 생성',
  PAYMENT_PAID: '결제 완료',
  ORDER_COMPLETED: '주문 완료',
  DELIVERY_DELIVERED: '배송 완료',
  DELIVERY_STARTED: '배송 시작',
  ORDER_CONFIRMED: '주문 확인',
}

const STATUS_LABELS: Record<NotificationStatus, string> = {
  READY: '대기',
  SUCCESS: '성공',
  FAILED: '실패',
}

const PAGE_SIZE = 20

const NotificationLog = () => {
  const queryClient = useQueryClient()
  const [templateFilter, setTemplateFilter] = useState<NotificationTemplateCode | ''>('')
  const [statusFilter, setStatusFilter] = useState<NotificationStatus | ''>('')
  const [page, setPage] = useState(0)

  const params = { page, size: PAGE_SIZE }

  const { data: listRes, isLoading } = useQuery({
    queryKey: ['admin', 'notifications', undefined, params],
    queryFn: () => apiService.getNotifications(params),
    enabled: !templateFilter && !statusFilter,
  })

  const { data: byTemplateRes, isLoading: loadingByTemplate } = useQuery({
    queryKey: ['admin', 'notifications', 'by-template', templateFilter, params],
    queryFn: () =>
      apiService.getNotificationsByTemplate(templateFilter as NotificationTemplateCode, params),
    enabled: !!templateFilter,
  })

  const { data: byStatusRes, isLoading: loadingByStatus } = useQuery({
    queryKey: ['admin', 'notifications', 'by-status', statusFilter, params],
    queryFn: () =>
      apiService.getNotificationsByStatus(statusFilter as NotificationStatus, params),
    enabled: !!statusFilter,
  })

  const res = templateFilter ? byTemplateRes : statusFilter ? byStatusRes : listRes
  const list = res?.data ?? []
  const loading = isLoading || loadingByTemplate || loadingByStatus

  const columns = [
    {
      title: 'ID',
      dataIndex: 'notificationLogId',
      width: 80,
      render: (id: number) => <Typography.Text type="secondary">{id}</Typography.Text>,
    },
    {
      title: '채널',
      dataIndex: 'channel',
      width: 90,
      render: (ch: string) => (
        <Tag color={ch === 'KAKAO' ? '#FEE500' : 'blue'}>{ch}</Tag>
      ),
    },
    {
      title: '템플릿',
      dataIndex: 'templateCode',
      width: 140,
      render: (code: NotificationTemplateCode) =>
        TEMPLATE_LABELS[code] ?? code,
    },
    {
      title: '상태',
      dataIndex: 'status',
      width: 80,
      render: () => <Tag color="success">{STATUS_LABELS.SUCCESS}</Tag>,
    },
    {
      title: '수신 번호',
      dataIndex: 'recipientPhone',
      width: 120,
    },
    {
      title: '실패 사유',
      dataIndex: 'failReason',
      ellipsis: true,
      render: (txt: string) =>
        txt ? <Typography.Text type="danger">{txt}</Typography.Text> : '-',
    },
  ]

  return (
    <div>
      <Card title="알림 로그 (KAKAO/SMS)">
        <Space style={{ marginBottom: 16 }} wrap>
          <Select
            placeholder="템플릿 필터"
            allowClear
            style={{ width: 160 }}
            value={templateFilter || undefined}
            onChange={(v) => {
              setTemplateFilter(v ?? '')
              setPage(0)
            }}
            options={[
              { value: '', label: '전체' },
              ...(Object.entries(TEMPLATE_LABELS).map(([k, v]) => ({
                value: k,
                label: v,
              })) as { value: string; label: string }[]),
            ]}
          />
          <Select
            placeholder="상태 필터"
            allowClear
            style={{ width: 120 }}
            value={statusFilter || undefined}
            onChange={(v) => {
              setStatusFilter(v ?? '')
              setPage(0)
            }}
            options={[
              { value: '', label: '전체' },
              { value: 'READY', label: '대기' },
              { value: 'SUCCESS', label: '성공' },
              { value: 'FAILED', label: '실패' },
            ]}
          />
          <ReloadOutlined
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: ['admin', 'notifications'] })
            }
            style={{ cursor: 'pointer', fontSize: 18 }}
          />
        </Space>
        <Table
          rowKey="notificationLogId"
          columns={columns}
          dataSource={list}
          loading={loading}
          pagination={{
            current: page + 1,
            pageSize: PAGE_SIZE,
            total:
              list.length < PAGE_SIZE
                ? page * PAGE_SIZE + list.length
                : (page + 1) * PAGE_SIZE + 1,
            showSizeChanger: false,
            onChange: (p) => setPage(p - 1),
          }}
          size="small"
        />
      </Card>
    </div>
  )
}

export default NotificationLog
