import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card,
  Descriptions,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Switch,
  message,
  Typography,
  Tag,
  Table,
} from 'antd'
import { EditOutlined, ShoppingCartOutlined, ReloadOutlined, StopOutlined, EyeOutlined } from '@ant-design/icons'
import { apiService } from '@/services/api'
import type { AddressCreateRequest, AddressUpdateRequest, CustomerBlockUpdateRequest } from '@/types/api'

const { Title } = Typography

const CustomerProfile = () => {
  const { customerId } = useParams<{ customerId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [addressForm] = Form.useForm()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAddress, setEditingAddress] = useState<number | null>(null)
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false)
  const [blockForm] = Form.useForm()

  const { data: profileData, isLoading, refetch } = useQuery({
    queryKey: ['customerProfile', customerId],
    queryFn: async () => {
      const response = await apiService.getCustomerProfile(Number(customerId));
      console.log('[CustomerProfile] 프로필 조회 응답:', JSON.stringify(response, null, 2));
      console.log('[CustomerProfile] 차단 정보:', {
        blocked: response.data?.customer?.blocked,
        blockedReason: response.data?.customer?.blockedReason,
        blockedAt: response.data?.customer?.blockedAt,
      });
      return response;
    },
    enabled: !!customerId,
  })

  const addAddressMutation = useMutation({
    mutationFn: (data: AddressCreateRequest) =>
      apiService.addAddress(Number(customerId), data),
    onSuccess: () => {
      message.success('주소가 등록되었습니다.')
      setIsModalOpen(false)
      addressForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['customerProfile', customerId] })
    },
    onError: (error: any) => {
      console.error('[addAddressMutation] 에러 상세:', error.response?.data);
      message.error(error.response?.data?.message || '주소 등록에 실패했습니다.')
    },
  })

  const updateAddressMutation = useMutation({
    mutationFn: ({ addressId, data }: { addressId: number; data: AddressUpdateRequest }) =>
      apiService.updateAddress(Number(customerId), addressId, data),
    onSuccess: () => {
      message.success('주소가 수정되었습니다.')
      setIsModalOpen(false)
      setEditingAddress(null)
      addressForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['customerProfile', customerId] })
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '주소 수정에 실패했습니다.')
    },
  })

  // 고객 차단/해제 처리
  const updateBlockedMutation = useMutation({
    mutationFn: (data: CustomerBlockUpdateRequest) =>
      apiService.updateCustomerBlocked(Number(customerId), data),
    onSuccess: (_, variables) => {
      // variables.blocked를 사용하여 실제 요청한 상태를 확인
      const action = variables.blocked ? '차단되었습니다' : '차단 해제되었습니다';
      message.success(`고객이 ${action}.`)
      setIsBlockModalOpen(false)
      blockForm.resetFields()
      // 모든 관련 쿼리 무효화 후 전체 API 다시 호출
      queryClient.invalidateQueries({ queryKey: ['customerProfile', customerId] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      refetch()
    },
    onError: (error: any) => {
      console.error('[CustomerProfile] 차단/해제 에러 상세:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data,
        message: error.message,
        fullError: error,
      });
      
      let errorMessage = '고객 차단/해제 처리에 실패했습니다.';
      if (error.response?.data) {
        if (error.response.data.message) {
          errorMessage = error.response.data.message;
        } else if (error.response.data.error) {
          errorMessage = error.response.data.error;
        } else if (typeof error.response.data === 'string') {
          errorMessage = error.response.data;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      message.error({
        content: errorMessage,
        duration: 5,
      });
    },
  })

  const handleBlockToggle = () => {
    const blockInfo = profileData?.data?.blockInfo
    const isCurrentlyBlocked = blockInfo?.blocked === true
    blockForm.setFieldsValue({
      blocked: !isCurrentlyBlocked,
      reason: blockInfo?.blockedReason || '',
    })
    setIsBlockModalOpen(true)
  }

  const handleBlockModalOk = () => {
    blockForm.validateFields().then((values: CustomerBlockUpdateRequest) => {
      console.log('[CustomerProfile] 차단/해제 요청 데이터:', values);
      updateBlockedMutation.mutate(values)
    }).catch((error) => {
      console.error('[CustomerProfile] 폼 검증 실패:', error);
    })
  }

  const handleEditAddress = () => {
    const addresses = profileData?.data?.addresses || []
    const address = addresses.length > 0 ? addresses[0] : null
    if (address) {
      setEditingAddress(address.addressId)
      addressForm.setFieldsValue({
        label: address.label,
        recipientName: address.recipientName,
        recipientPhone: address.recipientPhone,
        zipCode: address.zipCode,
        address1: address.address1,
        address2: address.address2,
        isDefault: address.isDefault,
      })
    } else {
      setEditingAddress(null)
      addressForm.resetFields()
      addressForm.setFieldsValue({ isDefault: true }) // 기본값으로 true 설정
    }
    setIsModalOpen(true)
  }

  const handleModalOk = () => {
    addressForm.validateFields().then((values) => {
      console.log('[handleModalOk] 폼 데이터:', values);
      // isDefault가 undefined이면 true로 설정 (기본 배송지)
      const addressData: AddressCreateRequest | AddressUpdateRequest = {
        label: values.label,
        recipientName: values.recipientName,
        recipientPhone: values.recipientPhone,
        zipCode: values.zipCode,
        address1: values.address1,
        address2: values.address2,
        isDefault: values.isDefault ?? true, // 기본값 true
      };
      console.log('[handleModalOk] 전송할 데이터:', addressData);
      if (editingAddress) {
        updateAddressMutation.mutate({ addressId: editingAddress, data: addressData })
      } else {
        addAddressMutation.mutate(addressData)
      }
    }).catch((error) => {
      console.error('[handleModalOk] 폼 검증 실패:', error);
    })
  }

  if (isLoading) {
    return <div>로딩 중...</div>
  }

  const customer = profileData?.data?.customer
  const blockInfo = profileData?.data?.blockInfo
  const addresses = profileData?.data?.addresses || []
  const address = addresses.length > 0 ? addresses[0] : null
  const isBlocked = blockInfo?.blocked === true
  const orders = profileData?.data?.orders || []

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Title level={2} style={{ margin: 0 }}>고객 프로필</Title>
        <Space wrap>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={() => {
              // 모든 관련 쿼리 무효화 후 강제로 다시 불러오기
              queryClient.invalidateQueries({ queryKey: ['customerProfile', customerId] })
              queryClient.refetchQueries({ queryKey: ['customerProfile', customerId] })
              refetch()
            }} 
            loading={isLoading}
          >
            새로고침
          </Button>
          <Button
            type="primary"
            icon={<ShoppingCartOutlined />}
            onClick={() => navigate(`/customers/${customerId}/orders`)}
          >
            주문 목록 보기
          </Button>
        </Space>
      </div>

      <Card 
        style={{ marginBottom: 24 }}
        extra={
          <Button 
            type={isBlocked ? "default" : "primary"}
            danger={!isBlocked}
            icon={<StopOutlined />}
            onClick={handleBlockToggle}
          >
            {isBlocked ? '차단 해제' : '고객 차단'}
          </Button>
        }
      >
        <Descriptions title="고객 정보" bordered>
          <Descriptions.Item label="고객 ID">{customer?.customerId}</Descriptions.Item>
          <Descriptions.Item label="이름">{customer?.name}</Descriptions.Item>
          <Descriptions.Item label="전화번호">{customer?.phone}</Descriptions.Item>
          <Descriptions.Item label="차단 상태">
            {isBlocked ? (
              <Tag color="red">차단됨</Tag>
            ) : (
              <Tag color="green">정상</Tag>
            )}
          </Descriptions.Item>
          {blockInfo?.blockedReason && (
            <Descriptions.Item label="차단 사유" span={2}>
              {blockInfo.blockedReason}
            </Descriptions.Item>
          )}
          {blockInfo?.blockedAt && (
            <Descriptions.Item label="차단 일시">
              {new Date(blockInfo.blockedAt).toLocaleString('ko-KR')}
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      <Card
        title="주소 정보"
        extra={
          <Button type="primary" icon={<EditOutlined />} onClick={handleEditAddress}>
            {address ? '주소 수정' : '주소 등록'}
          </Button>
        }
      >
        {address ? (
          <Descriptions bordered>
            <Descriptions.Item label="라벨">{address.label}</Descriptions.Item>
            <Descriptions.Item label="수령인">{address.recipientName}</Descriptions.Item>
            <Descriptions.Item label="수령인 전화번호">{address.recipientPhone}</Descriptions.Item>
            <Descriptions.Item label="우편번호">{address.zipCode}</Descriptions.Item>
            <Descriptions.Item label="기본 주소" span={2}>{address.address1}</Descriptions.Item>
            <Descriptions.Item label="상세 주소" span={2}>{address.address2}</Descriptions.Item>
            <Descriptions.Item label="기본 배송지">
              {address.isDefault ? <Tag color="blue">기본</Tag> : <span>일반</span>}
            </Descriptions.Item>
          </Descriptions>
        ) : (
          <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>
            등록된 주소가 없습니다. "주소 등록" 버튼을 클릭하여 주소를 등록해주세요.
          </div>
        )}
      </Card>

      {/* 구매이력 */}
      <Card
        title="구매이력"
        style={{ marginBottom: 24 }}
      >
        {orders.length > 0 ? (
          <Table
            columns={[
              {
                title: '주문 ID',
                dataIndex: 'orderId',
                key: 'orderId',
                width: 100,
              },
              {
                title: '주문번호',
                dataIndex: 'orderNo',
                key: 'orderNo',
                width: 180,
              },
              {
                title: '주문일시',
                dataIndex: 'createdAt',
                key: 'createdAt',
                width: 180,
                render: (date: string) => date ? new Date(date).toLocaleString('ko-KR') : '-',
              },
              {
                title: '상태',
                dataIndex: 'status',
                key: 'status',
                width: 120,
                render: (status: string) => {
                  const statusMap: Record<string, { color: string; text: string }> = {
                    CREATED: { color: 'orange', text: '생성됨' },
                    PAID: { color: 'blue', text: '결제완료' },
                    CONFIRMED: { color: 'cyan', text: '확인됨' },
                    COMPLETED: { color: 'green', text: '완료됨' },
                    CANCELED: { color: 'red', text: '취소됨' },
                  }
                  const statusInfo = statusMap[status] || { color: 'default', text: status }
                  return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>
                },
              },
              {
                title: '배송 상태',
                dataIndex: 'deliveryStatus',
                key: 'deliveryStatus',
                width: 120,
                render: (status: string) => {
                  const statusMap: Record<string, { color: string; text: string }> = {
                    NONE: { color: 'default', text: '없음' },
                    READY: { color: 'orange', text: '배송예약' },
                    DELIVERING: { color: 'blue', text: '배송중' },
                    DELIVERED: { color: 'green', text: '배송완료' },
                  }
                  const statusInfo = statusMap[status] || { color: 'default', text: status }
                  return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>
                },
              },
              {
                title: '최종금액',
                dataIndex: 'finalAmount',
                key: 'finalAmount',
                width: 120,
                align: 'right' as const,
                render: (amount: number) => new Intl.NumberFormat('ko-KR').format(amount) + '원',
              },
              {
                title: '작업',
                key: 'actions',
                width: 100,
                render: (_: any, record: any) => (
                  <Button
                    type="link"
                    icon={<EyeOutlined />}
                    onClick={() => navigate(`/orders/${record.orderId}`)}
                    size="small"
                  >
                    상세보기
                  </Button>
                ),
              },
            ]}
            dataSource={orders}
            rowKey="orderId"
            pagination={{ pageSize: 10 }}
            expandable={{
              expandedRowRender: (record: any) => {
                const items = record.items || []
                return (
                  <div style={{ padding: '16px 0' }}>
                    <Typography.Text strong style={{ marginBottom: 8, display: 'block' }}>
                      주문 상품 ({items.length}개)
                    </Typography.Text>
                    <Table
                      columns={[
                        {
                          title: '상품명',
                          dataIndex: 'productName',
                          key: 'productName',
                        },
                        {
                          title: '단가',
                          dataIndex: 'unitPrice',
                          key: 'unitPrice',
                          align: 'right' as const,
                          render: (price: number) => new Intl.NumberFormat('ko-KR').format(price) + '원',
                        },
                        {
                          title: '수량',
                          dataIndex: 'quantity',
                          key: 'quantity',
                          align: 'right' as const,
                        },
                        {
                          title: '합계',
                          dataIndex: 'lineTotal',
                          key: 'lineTotal',
                          align: 'right' as const,
                          render: (total: number) => new Intl.NumberFormat('ko-KR').format(total) + '원',
                        },
                      ]}
                      dataSource={items}
                      rowKey="orderItemId"
                      pagination={false}
                      size="small"
                    />
                    <div style={{ marginTop: 16, textAlign: 'right' }}>
                      <Space direction="vertical" align="end" size="small">
                        <div>상품 합계: {new Intl.NumberFormat('ko-KR').format(record.subtotalAmount || 0)}원</div>
                        <div>배송비: {new Intl.NumberFormat('ko-KR').format(record.deliveryFee || 0)}원</div>
                        <div>할인금액: {new Intl.NumberFormat('ko-KR').format(record.discountAmount || 0)}원</div>
                        <div style={{ fontWeight: 'bold', fontSize: 16 }}>
                          최종금액: {new Intl.NumberFormat('ko-KR').format(record.finalAmount || 0)}원
                        </div>
                      </Space>
                    </div>
                  </div>
                )
              },
              rowExpandable: (record: any) => (record.items || []).length > 0,
            }}
          />
        ) : (
          <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>
            구매이력이 없습니다.
          </div>
        )}
      </Card>

      <Modal
        title={editingAddress ? '주소 수정' : '주소 등록'}
        open={isModalOpen}
        onOk={handleModalOk}
        onCancel={() => {
          setIsModalOpen(false)
          setEditingAddress(null)
          addressForm.resetFields()
        }}
        confirmLoading={addAddressMutation.isPending || updateAddressMutation.isPending}
        width={600}
      >
        <Form form={addressForm} layout="vertical">
          <Form.Item
            label="주소 라벨"
            name="label"
            rules={[{ required: true, message: '주소 라벨을 입력해주세요.' }]}
            tooltip="집/회사/기타 등 주소를 구분할 수 있는 라벨"
          >
            <Input placeholder="예: 집, 회사, 기타" />
          </Form.Item>
          <Form.Item
            label="수령인 이름"
            name="recipientName"
            rules={[{ required: true, message: '수령인 이름을 입력해주세요.' }]}
          >
            <Input placeholder="수령인 이름" />
          </Form.Item>
          <Form.Item
            label="수령인 전화번호"
            name="recipientPhone"
            rules={[
              { required: true, message: '수령인 전화번호를 입력해주세요.' },
              { pattern: /^[0-9-]+$/, message: '올바른 전화번호 형식을 입력해주세요.' },
            ]}
          >
            <Input placeholder="010-1234-5678 또는 01012345678" />
          </Form.Item>
          <Form.Item
            label="우편번호"
            name="zipCode"
            rules={[{ required: true, message: '우편번호를 입력해주세요.' }]}
          >
            <Input placeholder="우편번호" maxLength={5} />
          </Form.Item>
          <Form.Item
            label="기본 주소"
            name="address1"
            rules={[{ required: true, message: '기본 주소를 입력해주세요.' }]}
            tooltip="도로명 주소 또는 지번 주소"
          >
            <Input placeholder="서울특별시 강남구 테헤란로 123" />
          </Form.Item>
          <Form.Item
            label="상세 주소"
            name="address2"
            rules={[{ required: true, message: '상세 주소를 입력해주세요.' }]}
            tooltip="동/호수 등 상세 주소"
          >
            <Input placeholder="101동 1001호" />
          </Form.Item>
          <Form.Item 
            label="기본 배송지" 
            name="isDefault" 
            valuePropName="checked"
            tooltip="기본 배송지로 설정하면 주문 시 자동으로 선택됩니다"
          >
            <Switch checkedChildren="기본" unCheckedChildren="일반" />
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

export default CustomerProfile
