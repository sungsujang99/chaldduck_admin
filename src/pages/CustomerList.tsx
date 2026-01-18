import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, Table, Space, Typography, Button, Modal, Form, Input, message, Tag, Switch } from 'antd'
import { EyeOutlined, PlusOutlined, ReloadOutlined, SearchOutlined, DownloadOutlined, StopOutlined } from '@ant-design/icons'
import * as XLSX from 'xlsx'
import { useNavigate } from 'react-router-dom'
import { apiService } from '@/services/api'
import type { CustomerUpsertRequest, CustomerListResponse, CustomerBlockUpdateRequest } from '@/types/api'

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

  // 고객 리스트 조회 (서버 사이드 페이지네이션 사용)
  const { data: customersData, isLoading, refetch } = useQuery({
    queryKey: ['customers', currentPage, searchPhone],
    queryFn: async () => {
      console.log(`[CustomerList] 고객 리스트 조회 시작 (페이지 ${currentPage})`);
      try {
        const response = await apiService.getAllCustomersAdmin({ page: currentPage - 1, size: pageSize });
        console.log('[CustomerList] 고객 리스트 조회 성공:', response);
        
        if (response.data && response.data.content) {
          // 전화번호 검색 필터링 (클라이언트 사이드)
          let filteredContent = response.data.content;
          if (searchPhone.trim()) {
            const searchLower = searchPhone.trim().toLowerCase().replace(/[-\s]/g, '');
            filteredContent = response.data.content.filter((customer: CustomerListResponse) => {
              const phoneLower = customer.phone.toLowerCase().replace(/[-\s]/g, '');
              return phoneLower.includes(searchLower);
            });
          }
          
          return { 
            status: 200, 
            message: 'OK', 
            data: filteredContent,
            total: searchPhone.trim() ? filteredContent.length : response.data.totalElements,
            totalPages: searchPhone.trim() 
              ? Math.ceil(filteredContent.length / pageSize)
              : response.data.totalPages,
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
  const displayedCustomers = customersData?.data || []
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

      // 엑셀 데이터 준비
      const excelData = customersToExport.map((customer) => {
        const isBlocked = customer.blockInfo?.blocked === true
        return {
          '고객 ID': customer.customerId,
          '이름': customer.name,
          '전화번호': customer.phone,
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
          placeholder="전화번호로 검색 (예: 010-1234-5678 또는 01012345678)"
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
                ? `"${searchPhone}"로 검색된 고객이 없습니다.`
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
