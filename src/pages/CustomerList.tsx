import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, Table, Space, Typography, Button, Modal, Form, Input, message, Tag, Switch } from 'antd'
import { EyeOutlined, PlusOutlined, ReloadOutlined, SearchOutlined, DownloadOutlined, StopOutlined } from '@ant-design/icons'
import * as XLSX from 'xlsx'
import { useNavigate } from 'react-router-dom'
import { apiService } from '@/services/api'
import type { CustomerUpsertRequest, CustomerListResponse, CustomerBlockUpdateRequest, OrderResponse } from '@/types/api'

const { Title } = Typography

// Note: API에 전체 고객 리스트 엔드포인트가 없어서
// 주문 데이터에서 고객 정보를 추출하는 방식으로 구현
// 실제로는 별도의 고객 리스트 API가 필요할 수 있습니다
const CustomerList = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [blockForm] = Form.useForm()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerListResponse | null>(null)
  const [searchPhone, setSearchPhone] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  // 고객 리스트 조회 (검색 시 전체 조회, 아닐 때는 페이지네이션)
  const { data: customersData, isLoading, refetch } = useQuery({
    queryKey: ['customers', currentPage, searchPhone],
    queryFn: async () => {
      console.log(`[CustomerList] 고객 리스트 조회 시작 (페이지 ${currentPage}, 검색어: "${searchPhone}")`);
      try {
        // 검색어가 있으면 전체 고객 조회 후 필터링
        if (searchPhone.trim()) {
          console.log('[CustomerList] 검색 모드 - 전체 고객 조회');
          const allCustomers: CustomerListResponse[] = [];
          let page = 0;
          let hasMore = true;
          
          while (hasMore) {
            const response = await apiService.getAllCustomersAdmin({ page, size: 100 });
            if (response.data && response.data.content && response.data.content.length > 0) {
              allCustomers.push(...response.data.content);
              page++;
              if (response.data.content.length < 100 || allCustomers.length >= response.data.totalElements) {
                hasMore = false;
              }
            } else {
              hasMore = false;
            }
          }
          
          console.log(`[CustomerList] 전체 고객 ${allCustomers.length}명 조회 완료`);
          
          // 전화번호 또는 이름으로 검색
          const searchLower = searchPhone.trim().toLowerCase().replace(/[-\s]/g, '');
          const filteredContent = allCustomers.filter((customer: CustomerListResponse) => {
            const phoneLower = customer.phone.toLowerCase().replace(/[-\s]/g, '');
            const nameLower = customer.name.toLowerCase();
            return phoneLower.includes(searchLower) || nameLower.includes(searchLower);
          });
          
          console.log(`[CustomerList] 검색 결과: ${filteredContent.length}명`);
          
          // 클라이언트 사이드 페이지네이션
          const startIdx = (currentPage - 1) * pageSize;
          const paginatedData = filteredContent.slice(startIdx, startIdx + pageSize);
          
          return { 
            status: 200, 
            message: 'OK', 
            data: paginatedData,
            total: filteredContent.length,
            totalPages: Math.ceil(filteredContent.length / pageSize),
            serverTotal: allCustomers.length,
          };
        }
        
        // 검색어가 없으면 서버 페이지네이션 사용
        const response = await apiService.getAllCustomersAdmin({ page: currentPage - 1, size: pageSize });
        console.log('[CustomerList] 고객 리스트 조회 성공:', response);
        
        if (response.data && response.data.content) {
          return { 
            status: 200, 
            message: 'OK', 
            data: response.data.content,
            total: response.data.totalElements,
            totalPages: response.data.totalPages,
            serverTotal: response.data.totalElements,
          };
        }
        return { status: 200, message: 'OK', data: [] as CustomerListResponse[], total: 0, totalPages: 0, serverTotal: 0 };
      } catch (err: any) {
        console.error('[CustomerList] 고객 리스트 조회 실패:', err);
        message.error('고객 목록을 불러오는데 실패했습니다.');
        return { status: 200, message: 'OK', data: [] as CustomerListResponse[], total: 0, totalPages: 0, serverTotal: 0 };
      }
    },
    retry: false,
  })

  // 표시할 고객 목록 (이전에 정의된 displayedCustomers보다 먼저 계산)
  const displayedCustomersRaw = customersData?.data || []

  // 고객별 통계 - 불러와지는 대로 표시 (progressive)
  const [customerStatsData, setCustomerStatsData] = useState<Record<number, { totalAmount: number; orderCount: number; address: string }>>({})
  const statsLoadTrigger = displayedCustomersRaw.map((c) => c.customerId).join(',')

  useEffect(() => {
    const customerIds = displayedCustomersRaw.map((c) => c.customerId).filter((id): id is number => id != null)
    if (customerIds.length === 0) {
      setCustomerStatsData({})
      return
    }

    let cancelled = false
    setCustomerStatsData({})

    const load = async () => {
      // 1) getAllOrdersAdmin 페이지별 조회 - 불러올 때마다 바로 통계 반영
      let bulkOrders: OrderResponse[] = []
      try {
        let page = 0
        const size = 100
        while (true) {
          const res = await apiService.getAllOrdersAdmin({ page, size })
          const orders = Array.isArray(res?.data) ? res.data : res?.data?.content ?? []
          if (orders.length === 0) break
          if (cancelled) return
          bulkOrders.push(...orders)
          // 페이지마다 즉시 통계 계산하여 표시
          const valid = bulkOrders.filter((o) => o.status !== 'CANCELED')
          const stats: Record<number, { totalAmount: number; orderCount: number; address: string }> = {}
          customerIds.forEach((cid) => {
            const ords = valid.filter((o) => Number(o.customerId) === Number(cid))
            const totalAmount = ords.reduce((s, o) => s + (o.finalAmount ?? o.subtotalAmount ?? 0), 0)
            const latest = ords
              .filter((o) => o.fulfillmentType === 'DELIVERY' && (o.address1 || o.address2))
              .sort((a, b) => (b.orderedAt || '').localeCompare(a.orderedAt || ''))[0]
            const address = latest ? [latest.address1, latest.address2].filter(Boolean).join(' ') : ''
            stats[cid] = { totalAmount, orderCount: ords.length, address }
          })
          setCustomerStatsData({ ...stats })
          if (orders.length < size || (res?.data && !Array.isArray(res.data) && (res.data as any).last)) break
          page++
        }
      } catch {
        bulkOrders = []
      }

      if (cancelled) return
      if (bulkOrders.length > 0) return

      // 2) 폴백: 고객별 조회 - 한 명씩 결과 나올 때마다 표시
      for (const customerId of customerIds) {
        if (cancelled) return
        try {
          const res = await apiService.getOrdersByCustomer(customerId)
          const orders = Array.isArray(res?.data) ? res.data : (res as any)?.data ? [res.data].flat() : []
          const validOrders = orders.filter((o: any) => o?.status !== 'CANCELED')
          const totalAmount = validOrders.reduce((s: number, o: any) => s + (o.finalAmount ?? o.subtotalAmount ?? 0), 0)
          const latest = validOrders
            .filter((o: any) => o.fulfillmentType === 'DELIVERY' && (o.address1 || o.address2))
            .sort((a: any, b: any) => (b.orderedAt || '').localeCompare(a.orderedAt || ''))[0]
          const address = latest ? [latest.address1, latest.address2].filter(Boolean).join(' ') : ''
          setCustomerStatsData((prev) => ({ ...prev, [customerId]: { totalAmount, orderCount: validOrders.length, address } }))
        } catch (err) {
          setCustomerStatsData((prev) => ({ ...prev, [customerId]: { totalAmount: 0, orderCount: 0, address: '' } }))
        }
      }
    }
    load()
    return () => { cancelled = true }
  }, [statsLoadTrigger])

  const customerTotalAmounts = useMemo(() => {
    const map: Record<number, number> = {}
    if (customerStatsData) {
      Object.entries(customerStatsData).forEach(([cid, stats]) => {
        map[Number(cid)] = (stats as any).totalAmount ?? 0
      })
    }
    return map
  }, [customerStatsData])

  const customerOrderCounts = useMemo(() => {
    const map: Record<number, number> = {}
    if (customerStatsData) {
      Object.entries(customerStatsData).forEach(([cid, stats]) => {
        map[Number(cid)] = (stats as any).orderCount ?? 0
      })
    }
    return map
  }, [customerStatsData])

  const customerAddresses = useMemo(() => {
    const map: Record<number, string> = {}
    if (customerStatsData) {
      Object.entries(customerStatsData).forEach(([cid, stats]) => {
        const addr = (stats as any).address
        if (addr) map[Number(cid)] = addr
      })
    }
    return map
  }, [customerStatsData])

  // 전화번호 포맷팅 (010-1234-5678 형식)
  const formatPhoneNumber = (phone?: string) => {
    if (!phone) return '-'
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length === 11) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`
    } else if (cleaned.length === 10) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
    }
    return phone
  }

  const createCustomerMutation = useMutation({
    mutationFn: (data: CustomerUpsertRequest) => apiService.identifyCustomer(data),
    onSuccess: (response) => {
      if (response.status === 200 && response.data) {
        message.success('고객이 추가되었습니다.')
        setIsModalOpen(false)
        form.resetFields()
        queryClient.invalidateQueries({ queryKey: ['customers'] })
        setCurrentPage(1) // 고객 추가 후 첫 페이지로 이동
        // 고객 프로필 페이지로 이동
        navigate(`/customers/${response.data.customerId}/profile`)
      } else {
        message.error(response.message || '고객 추가에 실패했습니다.')
      }
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '고객 추가 중 오류가 발생했습니다.')
    },
  })

  const updateBlockedMutation = useMutation({
    mutationFn: ({ customerId, data }: { customerId: number; data: CustomerBlockUpdateRequest }) =>
      apiService.updateCustomerBlocked(customerId, data),
    onSuccess: (_, variables) => {
      const action = variables.data.blocked ? '차단되었습니다' : '차단 해제되었습니다'
      message.success(`고객이 ${action}.`)
      setIsBlockModalOpen(false)
      blockForm.resetFields()
      setSelectedCustomer(null)
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '고객 차단/해제 처리에 실패했습니다.')
    },
  })

  const handleBlockToggle = (customer: CustomerListResponse) => {
    setSelectedCustomer(customer)
    const isCurrentlyBlocked = customer.blockInfo?.blocked === true
    blockForm.setFieldsValue({
      blocked: !isCurrentlyBlocked,
      reason: customer.blockInfo?.blockedReason || '',
    })
    setIsBlockModalOpen(true)
  }

  const handleBlockModalOk = () => {
    if (!selectedCustomer) return
    blockForm.validateFields().then((values: CustomerBlockUpdateRequest) => {
      updateBlockedMutation.mutate({
        customerId: selectedCustomer.customerId,
        data: values,
      })
    })
  }

  const handleAddCustomer = () => {
    setIsModalOpen(true)
  }

  const handleModalOk = () => {
    form.validateFields().then((values: CustomerUpsertRequest) => {
      createCustomerMutation.mutate(values)
    })
  }


  // 표시할 고객 목록 (이미 서버에서 페이지네이션된 데이터)
  const displayedCustomers = displayedCustomersRaw
  const totalPages = customersData?.totalPages || 0
  const totalCustomers = customersData?.total || 0

      // 엑셀 다운로드 함수 (전체 고객 데이터 다운로드 - 여러 페이지 조회 필요)
  const handleExportToExcel = async () => {
    try {
      message.loading({ content: '고객 데이터를 불러오는 중...', key: 'excel', duration: 0 });
      
      // 전체 고객 데이터 조회 (큰 사이즈로 한 번에 조회)
      const allCustomers: CustomerListResponse[] = [];
      let page = 0;
      let hasMore = true;
      
      while (hasMore) {
        try {
          const response = await apiService.getAllCustomersAdmin({ page, size: 100 });
          if (response.data && response.data.content && response.data.content.length > 0) {
            allCustomers.push(...response.data.content);
            page++;
            if (response.data.content.length < 100 || allCustomers.length >= response.data.totalElements) {
              hasMore = false;
            }
          } else {
            hasMore = false;
          }
        } catch (err) {
          console.error('[CustomerList] 엑셀 다운로드 중 에러:', err);
          hasMore = false;
        }
      }
      
      // 전화번호 필터링 적용
      let customersToExport = allCustomers;
      if (searchPhone.trim()) {
        const searchLower = searchPhone.trim().toLowerCase().replace(/[-\s]/g, '');
        customersToExport = allCustomers.filter((customer) => {
          const phoneLower = customer.phone.toLowerCase().replace(/[-\s]/g, '');
          return phoneLower.includes(searchLower);
        });
      }

      if (customersToExport.length === 0) {
        message.warning('다운로드할 고객 데이터가 없습니다.')
        return
      }

      // 엑셀용 고객별 주문 통계 조회 (getOrdersByCustomer)
      message.loading({ content: '고객별 사용 금액 조회 중...', key: 'excel', duration: 0 })
      const exportStats: Record<number, { totalAmount: number; orderCount: number; address: string }> = {}
      const BATCH_SIZE = 20
      for (let i = 0; i < customersToExport.length; i += BATCH_SIZE) {
        const batch = customersToExport.slice(i, i + BATCH_SIZE)
        const results = await Promise.all(
          batch.map(async (customer) => {
            try {
              const res = await apiService.getOrdersByCustomer(customer.customerId)
              const orders = Array.isArray(res?.data) ? res.data : []
              const validOrders = orders.filter((o: any) => o?.status !== 'CANCELED')
              const totalAmount = validOrders.reduce((sum: number, o: any) => sum + (o.finalAmount ?? o.subtotalAmount ?? 0), 0)
              const latestDeliveryOrder = validOrders
                .filter((o: any) => o.fulfillmentType === 'DELIVERY' && (o.address1 || o.address2))
                .sort((a: any, b: any) => (b.orderedAt || '').localeCompare(a.orderedAt || ''))[0]
              const address = latestDeliveryOrder
                ? [latestDeliveryOrder.address1, latestDeliveryOrder.address2].filter(Boolean).join(' ')
                : ''
              return { customerId: customer.customerId, totalAmount, orderCount: validOrders.length, address }
            } catch {
              return { customerId: customer.customerId, totalAmount: 0, orderCount: 0, address: '' }
            }
          })
        )
        results.forEach((r) => { exportStats[r.customerId] = { totalAmount: r.totalAmount, orderCount: r.orderCount, address: r.address } })
      }
      message.destroy('excel')

      // 엑셀 데이터 준비
      const excelData = customersToExport.map((customer) => {
        const isBlocked = customer.blockInfo?.blocked === true
        const stats = exportStats[customer.customerId] ?? { totalAmount: 0, orderCount: 0, address: '' }
        const totalAmount = stats.totalAmount
        const orderCount = stats.orderCount
        const primaryAddr = customer.addresses?.[0]
        const address = primaryAddr
          ? [primaryAddr.address1, primaryAddr.address2].filter(Boolean).join(' ')
          : stats.address || ''
        return {
          '고객 ID': customer.customerId,
          '이름': customer.name,
          '전화번호': customer.phone,
          '주소': address,
          '총 사용 금액': totalAmount,
          '이용 횟수': orderCount,
          '차단 여부': isBlocked ? '차단' : '정상',
          '차단 사유': customer.blockInfo?.blockedReason || '',
          '차단 일시': customer.blockInfo?.blockedAt || '',
        }
      })

      // 워크북 생성
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(excelData)

      // 컬럼 너비 설정
      const colWidths = [
        { wch: 12 }, // 고객 ID
        { wch: 20 }, // 이름
        { wch: 18 }, // 전화번호
        { wch: 35 }, // 주소
        { wch: 14 }, // 총 사용 금액
        { wch: 10 }, // 이용 횟수
        { wch: 12 }, // 차단 여부
        { wch: 30 }, // 차단 사유
        { wch: 20 }, // 차단 일시
      ]
      ws['!cols'] = colWidths

      XLSX.utils.book_append_sheet(wb, ws, '고객 목록')

      // 파일명 생성 (현재 날짜 포함)
      const fileName = `고객목록_${new Date().toISOString().split('T')[0]}.xlsx`

      // 파일 다운로드
      XLSX.writeFile(wb, fileName)
      message.success({ content: `엑셀 파일이 다운로드되었습니다. (${customersToExport.length}건)`, key: 'excel', duration: 3 })
    } catch (error: any) {
      console.error('[CustomerList] 엑셀 다운로드 실패:', error)
      message.error({ content: '엑셀 다운로드 중 오류가 발생했습니다.', key: 'excel' })
    }
  }


  const columns = [
    {
      title: '고객 ID',
      dataIndex: 'customerId',
      key: 'customerId',
      width: 100,
    },
    {
      title: '이름',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '전화번호',
      dataIndex: 'phone',
      key: 'phone',
      render: (phone: string) => formatPhoneNumber(phone),
    },
    {
      title: '주소',
      key: 'address',
      width: 200,
      ellipsis: true,
      render: (_: any, record: CustomerListResponse) => {
        const addrs = record.addresses;
        if (addrs?.length) {
          const primary = addrs[0];
          const addr = [primary.address1, primary.address2].filter(Boolean).join(' ');
          if (addr) return addr;
        }
        return customerAddresses[record.customerId] || '-';
      },
    },
    {
      title: '총 사용 금액',
      key: 'totalAmount',
      width: 160,
      render: (_: any, record: CustomerListResponse) => {
        const amount = customerTotalAmounts[record.customerId] || 0;
        const orderCount = customerOrderCounts[record.customerId] || 0;
        return (
          <div>
            <Typography.Text strong style={{ color: amount > 0 ? '#1890ff' : undefined }}>
              {amount.toLocaleString()}원
            </Typography.Text>
            <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
              {orderCount}회 이용
            </div>
          </div>
        );
      },
    },
    {
      title: '차단 상태',
      key: 'blocked',
      width: 180,
      render: (_: any, record: CustomerListResponse) => {
        const isBlocked = record.blockInfo?.blocked === true
        return (
          <Space>
            <Tag color={isBlocked ? 'red' : 'green'}>
              {isBlocked ? '차단됨' : '정상'}
            </Tag>
            <Button
              type="link"
              size="small"
              icon={<StopOutlined />}
              onClick={() => handleBlockToggle(record)}
              danger={!isBlocked}
            >
              {isBlocked ? '해제' : '차단'}
            </Button>
          </Space>
        )
      },
    },
    {
      title: '작업',
      key: 'actions',
      width: 120,
      render: (_: any, record: CustomerListResponse) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/customers/${record.customerId}/profile`)}
        >
          상세보기
        </Button>
      ),
    },
  ]

  return (
    <div>
      <Space 
        direction="vertical" 
        size="middle" 
        style={{ marginBottom: 24, width: '100%' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <Title level={2} style={{ margin: 0 }}>고객 목록</Title>
          <Space wrap>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={() => {
                // 모든 관련 쿼리 무효화 후 강제로 다시 불러오기
                queryClient.invalidateQueries({ queryKey: ['customers'] })
                queryClient.refetchQueries({ queryKey: ['customers'] })
                refetch()
              }} 
              loading={isLoading}
            >
              새로고침
            </Button>
            <Button 
              type="default" 
              icon={<DownloadOutlined />} 
              onClick={handleExportToExcel}
            >
              엑셀 다운로드
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddCustomer}>
              고객 추가
            </Button>
          </Space>
        </div>
        <Input
          placeholder="이름 또는 전화번호로 검색"
          prefix={<SearchOutlined />}
          value={searchPhone}
          onChange={(e) => {
            setSearchPhone(e.target.value)
            setCurrentPage(1) // 검색 시 첫 페이지로
          }}
          allowClear
          style={{ maxWidth: 400 }}
        />
        {totalCustomers > 0 && (
          <Space wrap>
            <Button 
              disabled={currentPage === 1} 
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            >
              이전 페이지
            </Button>
            <span>
              페이지 {currentPage} / {totalPages} 
              {searchPhone.trim() 
                ? ` (검색 결과: ${displayedCustomers.length}개)` 
                : ` (전체 ${totalCustomers}개 중 ${displayedCustomers.length}개 표시)`}
            </span>
            <Button 
              disabled={currentPage >= totalPages} 
              onClick={() => setCurrentPage(prev => prev + 1)}
            >
              다음 페이지
            </Button>
          </Space>
        )}
      </Space>

      <Card>
        <div style={{ overflowX: 'auto' }}>
          <Table
            columns={columns}
            dataSource={displayedCustomers}
            rowKey="customerId"
            loading={isLoading}
            pagination={{
              current: currentPage,
              pageSize: pageSize,
              total: totalCustomers,
              showTotal: (total) => `전체 ${total}개`,
              onChange: (page) => setCurrentPage(page),
            }}
            scroll={{ x: 'max-content' }}
            locale={{
              emptyText: searchPhone.trim() 
                ? `"${searchPhone}" 검색 결과가 없습니다.`
                : '고객 데이터가 없습니다. "고객 추가" 버튼을 클릭하여 고객을 등록해주세요.',
            }}
          />
        </div>
      </Card>

      <Modal
        title="고객 추가"
        open={isModalOpen}
        onOk={handleModalOk}
        onCancel={() => {
          setIsModalOpen(false)
          form.resetFields()
        }}
        confirmLoading={createCustomerMutation.isPending}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="고객 이름"
            name="name"
            rules={[{ required: true, message: '고객 이름을 입력해주세요.' }]}
          >
            <Input placeholder="예: 장성수" />
          </Form.Item>
          <Form.Item
            label="전화번호"
            name="phone"
            rules={[
              { required: true, message: '전화번호를 입력해주세요.' },
              { pattern: /^[0-9-]+$/, message: '올바른 전화번호 형식을 입력해주세요.' },
            ]}
          >
            <Input placeholder="010-1234-5678 또는 01012345678" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 고객 차단/해제 모달 */}
      <Modal
        title="고객 차단 설정"
        open={isBlockModalOpen}
        onOk={handleBlockModalOk}
        onCancel={() => {
          setIsBlockModalOpen(false)
          blockForm.resetFields()
          setSelectedCustomer(null)
        }}
        confirmLoading={updateBlockedMutation.isPending}
        okText="저장"
        cancelText="취소"
      >
        <Form form={blockForm} layout="vertical">
          <Form.Item
            label="차단 여부"
            name="blocked"
            valuePropName="checked"
            tooltip="차단된 고객은 주문을 할 수 없습니다"
          >
            <Switch checkedChildren="차단" unCheckedChildren="정상" />
          </Form.Item>
          <Form.Item
            label="차단 사유 (선택사항)"
            name="reason"
            tooltip="차단 사유를 입력하면 나중에 참고할 수 있습니다"
          >
            <Input.TextArea 
              placeholder="차단 사유를 입력하세요 (예: 악성 주문 반복, 환불 요구 등)"
              rows={4}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default CustomerList
