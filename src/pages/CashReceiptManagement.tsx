import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Card, Table, Space, Typography, Tag, Button, message, Modal, Tooltip, Progress } from 'antd'
import { ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { apiService } from '@/services/api'
import type { OrderResponse, PaymentMethod } from '@/types/api'

const CashReceiptManagement = () => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'pending' | 'issued'>('pending')
  const [ordersData, setOrdersData] = useState<OrderResponse[]>([])
  const [productTaxMap, setProductTaxMap] = useState<Record<number, string>>({})
  const [productTaxByName, setProductTaxByName] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [loadTrigger, setLoadTrigger] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [issuingOrderId, setIssuingOrderId] = useState<number | null>(null)
  const [cancelingOrderId, setCancelingOrderId] = useState<number | null>(null)
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number; success: number; fail: number } | null>(null)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const bulkCancelRef = useRef(false)

  const refetch = useCallback(() => {
    setLoadTrigger((t) => t + 1)
  }, [])

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)

    const load = async () => {
      try {
        const productsRes = await apiService.getProducts().catch(() => ({ data: [] }))
        const products = Array.isArray(productsRes?.data) ? productsRes.data : Array.isArray(productsRes) ? productsRes : []
        const taxMap: Record<number, string> = {}
        const taxByName: Record<string, string> = {}
        products.forEach((p: { productId?: number; name?: string; taxType?: string }) => {
          if (p.productId != null && p.taxType) taxMap[p.productId] = p.taxType
          if (p.name && p.taxType) {
            const norm = p.name.trim().replace(/\s+/g, ' ')
            taxByName[norm] = p.taxType
            taxByName[p.name.trim()] = p.taxType
          }
        })
        if (!cancelled) {
          setProductTaxMap(taxMap)
          setProductTaxByName(taxByName)
        }

        const allOrders: OrderResponse[] = []
        let page = 0
        const fetchPageSize = 100
        while (true) {
          const response = await apiService.getAllOrdersAdmin({ page, size: fetchPageSize })
          let orders: OrderResponse[] = []
          let isLastPage = true

          const pageData = (response as any)?.data ?? response
          if (pageData) {
            if (Array.isArray(pageData)) {
              orders = pageData
              isLastPage = orders.length < fetchPageSize
            } else if (pageData.content) {
              orders = pageData.content
              isLastPage = pageData.last === true || orders.length < fetchPageSize
            }
          }

          if (orders.length === 0) {
            if (!cancelled) {
              setOrdersData([...allOrders])
              setIsLoading(false)
            }
            break
          }
          if (cancelled) return

          allOrders.push(...orders)
          if (!cancelled) {
            setOrdersData([...allOrders])
            setIsLoading(false)
          }
          if (isLastPage) break
          page++
        }
      } catch (err: any) {
        if (!cancelled) {
          message.error('주문 목록을 불러오는데 실패했습니다.')
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [loadTrigger])

  const cashReceiptOrders = useMemo(() => {
    return ordersData.filter((o) => {
      if (o.deletedAt || o.active === false) return false
      if (o.status === 'CANCELED') return false
      return o.cashReceipt === true || o.cashReceiptIssued === true
    })
  }, [ordersData])

  const allPendingOrders = useMemo(() => {
    const yesterday = dayjs().startOf('day')
    return cashReceiptOrders.filter((o) => {
      if (o.cashReceiptIssued) return false
      if (!o.orderedAt) return false
      if (o.status !== 'COMPLETED') return false
      return dayjs(o.orderedAt).isBefore(yesterday)
    })
  }, [cashReceiptOrders])

  const pendingOrders = allPendingOrders

  const issuedOrders = useMemo(() => {
    return cashReceiptOrders.filter((o) => o.cashReceiptIssued === true)
  }, [cashReceiptOrders])

  const displayedOrders = activeTab === 'pending' ? pendingOrders : issuedOrders

  const handleTabChange = (tab: 'pending' | 'issued') => {
    setActiveTab(tab)
    setSelectedRowKeys([])
  }

  const computeTaxableAmount = useCallback((order: OrderResponse): number => {
    const items = order.items ?? []
    const discountAmount = order.discountAmount ?? 0
    let taxableSubtotal = 0
    let totalSubtotal = 0
    for (const it of items) {
      const lineTotal = it.lineTotal ?? 0
      totalSubtotal += lineTotal
      const pid = it.productId
      const pname = it.productName?.trim()
      const pnameNorm = pname?.replace(/\s+/g, ' ')
      const isTaxable =
        (pid != null && productTaxMap[pid] === 'TAXABLE') ||
        (pname && productTaxByName[pname] === 'TAXABLE') ||
        (pnameNorm && productTaxByName[pnameNorm] === 'TAXABLE')
      if (isTaxable) taxableSubtotal += lineTotal
    }
    if (totalSubtotal <= 0) return taxableSubtotal
    const afterDiscount = Math.max(0, totalSubtotal - discountAmount)
    return Math.round(taxableSubtotal * (afterDiscount / totalSubtotal))
  }, [productTaxMap, productTaxByName])

  const totalTaxableAmount = useMemo(() => {
    return displayedOrders.reduce((sum, o) => sum + computeTaxableAmount(o), 0)
  }, [displayedOrders, computeTaxableAmount])

  const handleIssue = async (orderId: number) => {
    setIssuingOrderId(orderId)
    try {
      const res = await apiService.issueCashReceiptBarobill(orderId)
      if (res.data?.issued) {
        message.success(`주문 ${orderId} 현금영수증 발급 완료`)
      } else {
        message.success(`주문 ${orderId} 현금영수증 발급 요청 처리됨`)
      }
      refetch()
    } catch (err: any) {
      const data = err.response?.data
      console.error(`[현금영수증 발급 실패] 주문 ${orderId}:`, err.response?.status, data)
      const detail = data?.message || data?.error || data?.detail || JSON.stringify(data) || ''
      message.error({
        content: `주문 ${orderId} 발급 실패: ${detail}`,
        duration: 8,
      })
    } finally {
      setIssuingOrderId(null)
    }
  }

  const runBulkIssue = (ids: number[]) => {
    if (ids.length === 0) return
    Modal.confirm({
      title: '현금영수증 발급',
      content: `${ids.length}건을 순차적으로 발급합니다. 진행하시겠습니까?`,
      okText: '발급',
      cancelText: '취소',
      onOk: async () => {
        bulkCancelRef.current = false
        let success = 0
        let fail = 0
        setBulkProgress({ current: 0, total: ids.length, success: 0, fail: 0 })

        for (let i = 0; i < ids.length; i++) {
          if (bulkCancelRef.current) break
          setIssuingOrderId(ids[i])
          try {
            await apiService.issueCashReceiptBarobill(ids[i])
            success++
          } catch {
            fail++
          }
          setBulkProgress({ current: i + 1, total: ids.length, success, fail })
          setIssuingOrderId(null)
        }

        setBulkProgress(null)
        setIssuingOrderId(null)
        setSelectedRowKeys([])
        if (bulkCancelRef.current) {
          message.info(`중단됨 — ${success}건 성공, ${fail}건 실패`)
        } else if (fail === 0) {
          message.success(`${success}건 발급 완료`)
        } else {
          message.warning(`${success}건 성공, ${fail}건 실패`)
        }
        refetch()
      },
    })
  }

  const handleBulkIssueSelected = () => {
    const ids = pendingOrders.filter((o) => selectedRowKeys.includes(o.orderId)).map((o) => o.orderId)
    if (ids.length === 0) {
      message.info('발급할 주문을 선택해주세요.')
      return
    }
    runBulkIssue(ids)
  }

  const handleBulkIssueAll = () => {
    const ids = pendingOrders.map((o) => o.orderId)
    if (ids.length === 0) {
      message.info('발급할 건이 없습니다.')
      return
    }
    runBulkIssue(ids)
  }

  const handleCancel = (orderId: number) => {
    Modal.confirm({
      title: '현금영수증 취소',
      content: `주문 ${orderId}의 현금영수증을 취소하시겠습니까?`,
      okText: '취소하기',
      okType: 'danger',
      cancelText: '닫기',
      onOk: async () => {
        setCancelingOrderId(orderId)
        try {
          await apiService.cancelCashReceipt(orderId)
          message.success(`주문 ${orderId} 현금영수증 취소 완료`)
          refetch()
        } catch (err: any) {
          message.error(err.response?.data?.message || `주문 ${orderId} 현금영수증 취소 실패`)
        } finally {
          setCancelingOrderId(null)
        }
      },
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원'
  }

  const formatPhone = (phone?: string) => {
    if (!phone) return '-'
    const c = phone.replace(/\D/g, '')
    if (c.length === 11) return `${c.slice(0, 3)}-${c.slice(3, 7)}-${c.slice(7)}`
    if (c.length === 10) return `${c.slice(0, 3)}-${c.slice(3, 6)}-${c.slice(6)}`
    return phone
  }

  const getStatusText = (status: string, fulfillmentType?: string) => {
    switch (status) {
      case 'CREATED': return '생성됨'
      case 'PAID': return fulfillmentType === 'PICKUP' ? '픽업대기' : '결제완료'
      case 'CONFIRMED': return '배송준비'
      case 'COMPLETED': return '완료'
      case 'CANCELED': return '취소'
      default: return status
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CREATED': return 'orange'
      case 'PAID': return 'blue'
      case 'CONFIRMED': return 'cyan'
      case 'COMPLETED': return 'green'
      case 'CANCELED': return 'red'
      default: return 'default'
    }
  }

  const getPaymentMethodText = (method?: PaymentMethod) => {
    if (method === 'BANK_TRANSFER') return '무통장'
    if (method === 'ZEROPAY') return '제로페이'
    if (method === 'CARD') return '카드'
    return '-'
  }

  const columns = [
    {
      title: 'ID',
      dataIndex: 'orderId',
      key: 'orderId',
      width: 60,
      render: (id: number) => (
        <Typography.Link onClick={() => navigate(`/orders/${id}`)}>{id}</Typography.Link>
      ),
    },
    {
      title: '주문번호',
      key: 'orderNo',
      width: 160,
      render: (_: any, record: OrderResponse) => {
        const shortNo = record.orderNo?.split('-').pop() || record.orderNo
        const date = record.orderedAt ? dayjs(record.orderedAt).format('MM/DD HH:mm') : '-'
        return (
          <Space direction="vertical" size={0}>
            <Typography.Text style={{ fontSize: 13 }}>{shortNo}</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>{date}</Typography.Text>
          </Space>
        )
      },
    },
    {
      title: '주문상태',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: string, record: OrderResponse) => (
        <Tag color={getStatusColor(status)} style={{ fontSize: 11 }}>
          {getStatusText(status, record.fulfillmentType)}
        </Tag>
      ),
    },
    {
      title: '주문자',
      key: 'customer',
      width: 130,
      render: (_: any, record: OrderResponse) => (
        <Space direction="vertical" size={0}>
          <Typography.Text style={{ fontSize: 13 }}>{record.recipientName || '-'}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            {formatPhone(record.recipientPhone)}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '과세 금액',
      key: 'taxableAmount',
      width: 120,
      align: 'right' as const,
      render: (_: any, record: OrderResponse) => {
        const amt = computeTaxableAmount(record)
        return (
          <Typography.Text strong style={{ color: amt > 0 ? '#1890ff' : '#999' }}>
            {formatCurrency(amt)}
          </Typography.Text>
        )
      },
    },
    {
      title: '결제수단',
      dataIndex: 'paymentMethod',
      key: 'paymentMethod',
      width: 90,
      render: (method: PaymentMethod) => getPaymentMethodText(method),
    },
    {
      title: '영수증 번호',
      dataIndex: 'cashReceiptNo',
      key: 'cashReceiptNo',
      width: 140,
      render: (no: string) => no || <Typography.Text type="secondary">-</Typography.Text>,
    },
    ...(activeTab === 'pending'
      ? [
          {
            title: '발급',
            key: 'action',
            width: 80,
            render: (_: any, record: OrderResponse) => (
              <Button
                type="primary"
                size="small"
                icon={<CheckCircleOutlined />}
                loading={issuingOrderId === record.orderId}
                onClick={(e) => {
                  e.stopPropagation()
                  handleIssue(record.orderId)
                }}
              >
                발급
              </Button>
            ),
          },
        ]
      : [
          {
            title: '취소',
            key: 'action',
            width: 80,
            render: (_: any, record: OrderResponse) => (
              <Button
                size="small"
                danger
                icon={<CloseCircleOutlined />}
                loading={cancelingOrderId === record.orderId}
                onClick={(e) => {
                  e.stopPropagation()
                  handleCancel(record.orderId)
                }}
              >
                취소
              </Button>
            ),
          },
        ]),
  ]

  return (
    <div>
      <Card
        title={
          <Space>
            <span style={{ fontWeight: 600, fontSize: 16 }}>현금영수증 관리</span>
          </Space>
        }
        extra={
          <Space>
            {activeTab === 'pending' && pendingOrders.length > 0 && !bulkProgress && (
              <>
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  onClick={handleBulkIssueSelected}
                  disabled={selectedRowKeys.length === 0}
                >
                  선택 발급 {selectedRowKeys.length > 0 ? `(${selectedRowKeys.length}건)` : ''}
                </Button>
                <Button
                  icon={<ThunderboltOutlined />}
                  onClick={handleBulkIssueAll}
                >
                  전체 발급 ({pendingOrders.length}건)
                </Button>
              </>
            )}
            {bulkProgress && (
              <Button
                danger
                onClick={() => { bulkCancelRef.current = true }}
              >
                중단
              </Button>
            )}
            <Button
              icon={<ReloadOutlined spin={isRefreshing} />}
              onClick={() => {
                setIsRefreshing(true)
                refetch()
                setTimeout(() => {
                  setIsRefreshing(false)
                  message.success({ content: '새로고침 완료', duration: 1.5 })
                }, 300)
              }}
              loading={isRefreshing}
              disabled={!!bulkProgress}
            >
              새로고침
            </Button>
          </Space>
        }
      >
        {displayedOrders.length > 0 && (
          <div style={{ marginBottom: 16, padding: '12px 16px', background: '#e6f7ff', borderRadius: 8, border: '1px solid #91d5ff' }}>
            <Typography.Text strong>표시 중 과세 금액 합계: </Typography.Text>
            <Typography.Text strong style={{ color: '#1890ff', fontSize: 16 }}>{formatCurrency(totalTaxableAmount)}</Typography.Text>
            <Typography.Text type="secondary" style={{ marginLeft: 8 }}>({displayedOrders.length}건)</Typography.Text>
          </div>
        )}
        <div style={{ marginBottom: 16, display: 'flex', gap: 24 }}>
          <Tooltip title="현금영수증 신청했으나 아직 발급되지 않은 주문 (D-1)">
            <div
              onClick={() => handleTabChange('pending')}
              style={{
                cursor: 'pointer',
                padding: '12px 24px',
                borderRadius: 8,
                background: activeTab === 'pending' ? '#fff7e6' : '#fafafa',
                border: activeTab === 'pending' ? '2px solid #fa8c16' : '1px solid #d9d9d9',
                textAlign: 'center',
                minWidth: 140,
                transition: 'all 0.2s',
              }}
            >
              <div style={{ fontSize: 28, fontWeight: 700, color: '#fa8c16' }}>
                {pendingOrders.length}
              </div>
              <div style={{ fontSize: 14, color: '#666' }}>미발급</div>
            </div>
          </Tooltip>
          <Tooltip title="현금영수증 발급 완료된 주문">
            <div
              onClick={() => handleTabChange('issued')}
              style={{
                cursor: 'pointer',
                padding: '12px 24px',
                borderRadius: 8,
                background: activeTab === 'issued' ? '#f6ffed' : '#fafafa',
                border: activeTab === 'issued' ? '2px solid #52c41a' : '1px solid #d9d9d9',
                textAlign: 'center',
                minWidth: 140,
                transition: 'all 0.2s',
              }}
            >
              <div style={{ fontSize: 28, fontWeight: 700, color: '#52c41a' }}>
                {issuedOrders.length}
              </div>
              <div style={{ fontSize: 14, color: '#666' }}>발급완료</div>
            </div>
          </Tooltip>
        </div>

        {bulkProgress && (
          <div style={{ marginBottom: 16, padding: '12px 16px', background: '#f6ffed', borderRadius: 8, border: '1px solid #b7eb8f' }}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>
              발급 진행 중... {bulkProgress.current} / {bulkProgress.total}
              <span style={{ marginLeft: 12, color: '#52c41a' }}>성공 {bulkProgress.success}</span>
              {bulkProgress.fail > 0 && <span style={{ marginLeft: 8, color: '#ff4d4f' }}>실패 {bulkProgress.fail}</span>}
            </div>
            <Progress
              percent={Math.round((bulkProgress.current / bulkProgress.total) * 100)}
              status={bulkProgress.fail > 0 ? 'exception' : 'active'}
              strokeColor={bulkProgress.fail > 0 ? undefined : '#52c41a'}
            />
          </div>
        )}

        <Table
          columns={columns}
          dataSource={displayedOrders}
          rowKey="orderId"
          loading={isLoading}
          rowSelection={
            activeTab === 'pending'
              ? {
                  selectedRowKeys,
                  onChange: (keys) => setSelectedRowKeys(keys as React.Key[]),
                }
              : undefined
          }
          onRow={(record) => ({
            onClick: (e) => {
              if ((e.target as HTMLElement).closest('.ant-table-selection-column')) return
              navigate(`/orders/${record.orderId}`)
            },
            style: { cursor: 'pointer' },
          })}
          pagination={{
            showTotal: (total) => `전체 ${total}건`,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            defaultPageSize: 20,
          }}
          scroll={{ x: 'max-content' }}
          locale={{
            emptyText: isLoading
              ? '데이터를 불러오는 중...'
              : activeTab === 'pending'
              ? '미발급 현금영수증이 없습니다.'
              : '발급된 현금영수증이 없습니다.',
          }}
        />
      </Card>
    </div>
  )
}

export default CashReceiptManagement
