import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, Tag, Space, Button, Switch, message, Spin, Table, DatePicker, Tabs, Divider } from 'antd'
import { ApiOutlined, ReloadOutlined, SettingOutlined, DownloadOutlined } from '@ant-design/icons'
import * as XLSX from 'xlsx'
import dayjs, { Dayjs } from 'dayjs'
import { useNavigate } from 'react-router-dom'
import { apiService } from '@/services/api'
import type { FeatureFlagResponse, FeatureKey, OrderResponse, SalesStatRow } from '@/types/api'

// const { RangePicker } = DatePicker // 현재 사용하지 않음

const Dashboard = () => {
  const navigate = useNavigate()
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [lastCheck, setLastCheck] = useState<Date | null>(null)
  const [lastAutoRefresh, setLastAutoRefresh] = useState<Date | null>(null)
  const queryClient = useQueryClient()
  const [salesStatsTab, setSalesStatsTab] = useState<'daily' | 'weekly' | 'monthly'>('daily')
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs())
  const [selectedWeek, setSelectedWeek] = useState<string>(() => {
    const today = dayjs()
    const weekStart = today.startOf('week')
    return weekStart.format('YYYY-MM-DD')
  })
  const [selectedMonth, setSelectedMonth] = useState<string>(dayjs().format('YYYY-MM'))

  // API 상태 확인
  const { refetch: checkApiStatus } = useQuery({
    queryKey: ['apiStatus'],
    queryFn: async () => {
      try {
        // 간단한 API 호출로 상태 확인 (알림 로그 조회)
        const response = await apiService.getNotifications({ page: 0, size: 1 })
        setApiStatus('online')
        setLastCheck(new Date())
        return response
      } catch (error: any) {
        setApiStatus('offline')
        setLastCheck(new Date())
        throw error
      }
    },
    enabled: false, // 수동으로만 실행
    retry: false,
  })

  // 기능 플래그 조회
  const { data: featuresData, isLoading: featuresLoading } = useQuery({
    queryKey: ['features'],
    queryFn: async () => {
      const response = await apiService.getFeatures()
      console.log('[Dashboard] 기능 플래그 조회 응답:', response)
      console.log('[Dashboard] 기능 목록:', response.data?.map(f => ({ key: f.key, enabled: f.enabled, description: f.description })))
      return response
    },
  })

  // 매출 통계 조회
  const { data: dailySalesData, isLoading: dailySalesLoading } = useQuery({
    queryKey: ['dailySales', selectedDate],
    queryFn: () => {
      const dateStr = selectedDate.format('YYYY-MM-DD')
      return apiService.getDailySalesStats(dateStr, dateStr)
    },
    enabled: salesStatsTab === 'daily',
  })

  const { data: weeklySalesData, isLoading: weeklySalesLoading } = useQuery({
    queryKey: ['weeklySales', selectedWeek],
    queryFn: () => {
      const weekStart = dayjs(selectedWeek)
      const weekEnd = weekStart.endOf('week')
      return apiService.getWeeklySalesStats(
        weekStart.format('YYYY-MM-DD'),
        weekEnd.format('YYYY-MM-DD')
      )
    },
    enabled: salesStatsTab === 'weekly',
  })

  const { data: monthlySalesData, isLoading: monthlySalesLoading } = useQuery({
    queryKey: ['monthlySales', selectedMonth],
    queryFn: () => {
      const monthStart = dayjs(selectedMonth).startOf('month')
      const monthEnd = dayjs(selectedMonth).endOf('month')
      return apiService.getMonthlySalesStats(
        monthStart.format('YYYY-MM-DD'),
        monthEnd.format('YYYY-MM-DD')
      )
    },
    enabled: salesStatsTab === 'monthly',
  })

  const currentSalesData = useMemo(() => {
    if (salesStatsTab === 'daily') return dailySalesData
    if (salesStatsTab === 'weekly') return weeklySalesData
    return monthlySalesData
  }, [salesStatsTab, dailySalesData, weeklySalesData, monthlySalesData])

  const currentSalesLoading = useMemo(() => {
    if (salesStatsTab === 'daily') return dailySalesLoading
    if (salesStatsTab === 'weekly') return weeklySalesLoading
    return monthlySalesLoading
  }, [salesStatsTab, dailySalesLoading, weeklySalesLoading, monthlySalesLoading])

  // 주문 통계 조회 (새로운 페이징 API 사용)
  const { data: ordersStatsData, isLoading: ordersStatsLoading } = useQuery({
    queryKey: ['allOrdersForStats'],
    queryFn: async () => {
      try {
        console.log('[Dashboard] 주문 통계 조회 시작 (새로운 페이징 API 사용)')
        
        // 모든 주문을 페이징으로 가져오기
        const allOrders: OrderResponse[] = []
        let page = 0
        const pageSize = 100 // 한 번에 많이 가져오기
        let hasMore = true

        while (hasMore) {
          try {
            const response = await apiService.getAllOrdersAdmin({ page, size: pageSize })
            
            if (response.data && response.data.content && response.data.content.length > 0) {
              allOrders.push(...response.data.content)
              
              // 마지막 페이지인지 확인
              if (response.data.last || response.data.content.length < pageSize) {
                hasMore = false
              } else {
                page++
              }
            } else {
              hasMore = false
            }
          } catch (err: any) {
            console.error(`[Dashboard] 주문 조회 실패 (페이지 ${page}):`, err.message)
            hasMore = false
          }
        }

        console.log(`[Dashboard] 총 ${allOrders.length}개의 주문 조회 완료`)
        return { status: 200, message: 'OK', data: allOrders }
      } catch (error: any) {
        console.error('[Dashboard] 주문 통계 조회 실패:', error)
        throw error
      }
    },
    retry: false,
  })

  // 주문 통계 계산
  const orderStats = useMemo(() => {
    if (!ordersStatsData?.data) {
      return {
        total: 0,
        created: 0,
        paid: 0,
        confirmed: 0,
        completed: 0,
        canceled: 0,
      }
    }

    const orders = ordersStatsData.data
    return {
      total: orders.length,
      created: orders.filter((o) => o.status === 'CREATED').length,
      paid: orders.filter((o) => o.status === 'PAID').length,
      confirmed: orders.filter((o) => o.status === 'CONFIRMED').length,
      completed: orders.filter((o) => o.status === 'COMPLETED').length,
      canceled: orders.filter((o) => o.status === 'CANCELED').length,
    }
  }, [ordersStatsData])

  // 기능 토글
  const toggleFeatureMutation = useMutation({
    mutationFn: ({ key, enabled }: { key: FeatureKey; enabled: boolean }) =>
      apiService.toggleFeature(key, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['features'] })
      message.success('기능 상태가 변경되었습니다.')
    },
    onError: (error: any) => {
      message.error(`기능 상태 변경에 실패했습니다: ${error.response?.data?.message || error.message}`)
    },
  })

  useEffect(() => {
    // 컴포넌트 마운트 시 API 상태 확인
    checkApiStatus()
  }, [])

  // 10분마다 자동 새로고침
  useEffect(() => {
    const AUTO_REFRESH_INTERVAL = 10 * 60 * 1000 // 10분 (600,000ms)

    // 초기 로드 시간 기록
    setLastAutoRefresh(new Date())

    const intervalId = setInterval(() => {
      console.log('[Dashboard] 자동 새로고침 실행 (10분마다)')
      
      // 새로고침 시간 업데이트
      const now = new Date()
      setLastAutoRefresh(now)
      
      // 모든 쿼리 무효화 및 재조회
      queryClient.invalidateQueries({ queryKey: ['features'] })
      queryClient.invalidateQueries({ queryKey: ['allOrdersForStats'] })
      queryClient.invalidateQueries({ queryKey: ['dailySales'] })
      queryClient.invalidateQueries({ queryKey: ['weeklySales'] })
      queryClient.invalidateQueries({ queryKey: ['monthlySales'] })
      
      // API 상태도 다시 확인
      checkApiStatus()
      
      message.info('대시보드 데이터를 자동으로 새로고침했습니다.', 2)
    }, AUTO_REFRESH_INTERVAL)

    // 클린업: 컴포넌트 언마운트 시 interval 제거
    return () => {
      clearInterval(intervalId)
    }
  }, [queryClient, checkApiStatus])

  const handleFeatureToggle = (key: FeatureKey, enabled: boolean) => {
    toggleFeatureMutation.mutate({ key, enabled })
  }

  const getFeatureLabel = (key: FeatureKey) => {
    switch (key) {
      case 'ORDER':
        return '주문서'
      case 'BANK_TRANSFER':
        return '배송'
      default:
        return key
    }
  }

  const handleRefreshStatus = () => {
    setApiStatus('checking')
    checkApiStatus()
  }

  const handleManualRefresh = () => {
    console.log('[Dashboard] 수동 새로고침 실행')
    
    // 새로고침 시간 업데이트
    setLastAutoRefresh(new Date())
    
    // 모든 쿼리 무효화 및 재조회
    queryClient.invalidateQueries({ queryKey: ['features'] })
    queryClient.invalidateQueries({ queryKey: ['allOrdersForStats'] })
    queryClient.invalidateQueries({ queryKey: ['dailySales'] })
    queryClient.invalidateQueries({ queryKey: ['weeklySales'] })
    queryClient.invalidateQueries({ queryKey: ['monthlySales'] })
    
    // API 상태도 다시 확인
    checkApiStatus()
    
    message.success('대시보드를 새로고침했습니다.')
  }

  // 주문 상태별 페이지 이동
  const handleGoToOrders = (status: 'CREATED' | 'PAID') => {
    navigate(`/orders?status=${status}`)
  }

  const getApiStatusColor = () => {
    switch (apiStatus) {
      case 'online':
        return 'green'
      case 'offline':
        return 'red'
      case 'checking':
        return 'orange'
      default:
        return 'default'
    }
  }

  const getApiStatusText = () => {
    switch (apiStatus) {
      case 'online':
        return '온라인'
      case 'offline':
        return '오프라인'
      case 'checking':
        return '확인 중...'
      default:
        return '알 수 없음'
    }
  }

  // 주문 상태 한글 변환
  const getOrderStatusText = (status: string) => {
    switch (status) {
      case 'CREATED':
        return '생성됨'
      case 'PAID':
        return '결제완료'
      case 'CONFIRMED':
        return '확인됨'
      case 'COMPLETED':
        return '완료됨'
      case 'CANCELED':
        return '취소됨'
      default:
        return status
    }
  }

  // 배송 상태 한글 변환
  const getDeliveryStatusText = (status: string) => {
    switch (status) {
      case 'NONE':
        return '없음'
      case 'READY':
        return '배송예약'
      case 'DELIVERING':
        return '배송중'
      case 'DELIVERED':
        return '배송완료'
      default:
        return status
    }
  }

  // 주문 엑셀 다운로드 함수
  const handleExportOrdersToExcel = async () => {
    if (!ordersStatsData?.data || ordersStatsData.data.length === 0) {
      message.warning('다운로드할 주문 데이터가 없습니다.')
      return
    }

    try {
      message.loading({ content: '엑셀 파일 생성 중...', key: 'excel' })
      const orders = ordersStatsData.data

      // 각 주문의 결제 정보 조회
      const ordersWithPayment = await Promise.all(
        orders.map(async (order) => {
          let paymentMethod = '미결제'
          try {
            const paymentResponse = await apiService.getPaymentByOrder(order.orderId)
            if (paymentResponse?.data) {
              paymentMethod = paymentResponse.data.method === 'BANK_TRANSFER' ? '무통장 입금' : '카드'
            }
          } catch {
            // 결제 정보가 없으면 무시
          }
          return { ...order, paymentMethod }
        })
      )

      // 엑셀 데이터 준비
      const excelData = ordersWithPayment.map((order) => {
        return {
          '주문 ID': order.orderId,
          '주문번호': order.orderNo,
          '고객 ID': order.customerId,
          '주문 상태': getOrderStatusText(order.status),
          '배송 상태': getDeliveryStatusText(order.deliveryStatus),
          '배송 방식': order.fulfillmentType === 'DELIVERY' ? '배송' : '픽업',
          '결제 수단': order.paymentMethod || '미결제',
          '수령인': order.recipientName,
          '수령인 전화번호': order.recipientPhone,
          '우편번호': order.zipCode,
          '주소1': order.address1,
          '주소2': order.address2,
          '상품 합계': order.subtotalAmount,
          '배송비': order.deliveryFee,
          '할인금액': order.discountAmount,
          '최종금액': order.finalAmount,
          '현금영수증': order.cashReceipt ? '발급' : '미발급',
          '운송장번호': order.trackingNo || '',
          '상품 수': order.items?.length || 0,
          '상품 목록': order.items?.map(item => `${item.productName} (${item.quantity}개)`).join(', ') || '',
        }
      })

      // 워크북 생성
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(excelData)

      // 컬럼 너비 설정
      const colWidths = [
        { wch: 10 }, // 주문 ID
        { wch: 20 }, // 주문번호
        { wch: 10 }, // 고객 ID
        { wch: 12 }, // 주문 상태
        { wch: 12 }, // 배송 상태
        { wch: 12 }, // 배송 방식
        { wch: 15 }, // 결제 수단
        { wch: 15 }, // 수령인
        { wch: 15 }, // 수령인 전화번호
        { wch: 10 }, // 우편번호
        { wch: 30 }, // 주소1
        { wch: 30 }, // 주소2
        { wch: 12 }, // 상품 합계
        { wch: 10 }, // 배송비
        { wch: 12 }, // 할인금액
        { wch: 12 }, // 최종금액
        { wch: 12 }, // 현금영수증
        { wch: 15 }, // 운송장번호
        { wch: 10 }, // 상품 수
        { wch: 50 }, // 상품 목록
      ]
      ws['!cols'] = colWidths

      XLSX.utils.book_append_sheet(wb, ws, '주문 목록')

      // 파일명 생성 (현재 날짜 포함)
      const fileName = `주문목록_${new Date().toISOString().split('T')[0]}.xlsx`

      // 파일 다운로드
      XLSX.writeFile(wb, fileName)
      message.success({ content: '엑셀 파일이 다운로드되었습니다.', key: 'excel' })
    } catch (error: any) {
      console.error('[Dashboard] 엑셀 다운로드 실패:', error)
      message.error({ content: '엑셀 다운로드 중 오류가 발생했습니다.', key: 'excel' })
    }
  }

  // 매출 통계 엑셀 다운로드 함수
  const handleExportSalesToExcel = () => {
    if (!currentSalesData?.data || currentSalesData.data.length === 0) {
      message.warning('다운로드할 매출 데이터가 없습니다.')
      return
    }

    try {
      message.loading({ content: '엑셀 파일 생성 중...', key: 'salesExcel' })

      // 엑셀 데이터 준비
      const excelData = currentSalesData.data.map((row: SalesStatRow) => {
        let periodLabel = ''
        if (salesStatsTab === 'daily') {
          periodLabel = dayjs(row.periodStart).format('YYYY-MM-DD')
        } else if (salesStatsTab === 'weekly') {
          periodLabel = dayjs(row.periodStart).format('YYYY-MM-DD') + ' (주)'
        } else {
          periodLabel = dayjs(row.periodStart).format('YYYY-MM')
        }

        return {
          '기간': periodLabel,
          '카드 건수': row.card.count,
          '카드 금액': row.card.net,
          '무통장 건수': row.bankTransfer.count,
          '무통장 금액': row.bankTransfer.net,
          '총 건수': row.total.count,
          '총 금액': row.total.net,
        }
      })

      // 워크북 생성
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(excelData)

      // 컬럼 너비 설정
      const colWidths = [
        { wch: 15 }, // 기간
        { wch: 12 }, // 카드 건수
        { wch: 15 }, // 카드 금액
        { wch: 12 }, // 무통장 건수
        { wch: 15 }, // 무통장 금액
        { wch: 12 }, // 총 건수
        { wch: 15 }, // 총 금액
      ]
      ws['!cols'] = colWidths

      const tabLabel = salesStatsTab === 'daily' ? '일별' : salesStatsTab === 'weekly' ? '주별' : '월별'
      XLSX.utils.book_append_sheet(wb, ws, `${tabLabel} 매출`)

      // 파일명 생성 (현재 날짜 포함)
      const fileName = `매출통계_${tabLabel}_${new Date().toISOString().split('T')[0]}.xlsx`

      // 파일 다운로드
      XLSX.writeFile(wb, fileName)
      message.success({ content: '엑셀 파일이 다운로드되었습니다.', key: 'salesExcel' })
    } catch (error: any) {
      console.error('[Dashboard] 매출 엑셀 다운로드 실패:', error)
      message.error({ content: '엑셀 다운로드 중 오류가 발생했습니다.', key: 'salesExcel' })
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ margin: 0 }}>대시보드</h1>
        <Space wrap>
          {lastAutoRefresh && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', backgroundColor: '#f0f0f0', borderRadius: 4 }}>
              <ReloadOutlined spin={false} style={{ color: '#52c41a' }} />
              <span style={{ fontSize: 13, color: '#666' }}>
                마지막 새로고침: {lastAutoRefresh.toLocaleTimeString('ko-KR')}
                <span style={{ marginLeft: 8, color: '#999' }}>(10분마다 자동)</span>
              </span>
            </div>
          )}
          <Button
            icon={<ReloadOutlined />}
            onClick={handleManualRefresh}
            type="primary"
          >
            새로고침
          </Button>
        </Space>
      </div>
      
      {/* API 상태 카드 */}
      <Card style={{ marginBottom: 24 }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
            <Space>
              <ApiOutlined style={{ fontSize: 24 }} />
              <div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>API 서버 상태</div>
                <div style={{ fontSize: 14, color: '#666', marginTop: 4, wordBreak: 'break-all' }}>
                  {import.meta.env.VITE_API_BASE_URL || 'https://찰떡상회.com'}
                </div>
              </div>
            </Space>
            <Space wrap>
              <Tag color={getApiStatusColor()} style={{ fontSize: 14, padding: '4px 12px' }}>
                {getApiStatusText()}
              </Tag>
              <Button 
                icon={<ReloadOutlined />} 
                onClick={handleRefreshStatus}
                loading={apiStatus === 'checking'}
              >
                상태 확인
              </Button>
            </Space>
          </div>
          {lastCheck && (
            <div style={{ fontSize: 12, color: '#999' }}>
              마지막 확인: {lastCheck.toLocaleTimeString('ko-KR')}
            </div>
          )}
          
          {/* 기능 On/Off */}
          <Divider style={{ margin: '16px 0' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <SettingOutlined style={{ fontSize: 20 }} />
            <div style={{ fontSize: 16, fontWeight: 600 }}>기능 On/Off</div>
          </div>
          {featuresLoading ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <Spin size="small" />
              <div style={{ marginTop: 8, color: '#666', fontSize: 12 }}>기능 정보를 불러오는 중...</div>
            </div>
          ) : featuresData?.data && featuresData.data.length > 0 ? (
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              {featuresData.data.map((feature: FeatureFlagResponse) => (
                <div
                  key={feature.key}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: '1px solid #f0f0f0',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500 }}>{getFeatureLabel(feature.key)}</div>
                    {feature.description && (
                      <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                        {feature.description}
                      </div>
                    )}
                  </div>
                  <Switch
                    checked={feature.enabled}
                    onChange={(checked) => handleFeatureToggle(feature.key, checked)}
                    loading={toggleFeatureMutation.isPending}
                    checkedChildren="ON"
                    unCheckedChildren="OFF"
                  />
                </div>
              ))}
            </Space>
          ) : (
            <div style={{ color: '#999', fontSize: 12 }}>기능 정보를 불러올 수 없습니다.</div>
          )}
        </Space>
      </Card>

      {/* 주문 통계 카드 */}
      <Card 
        title="주문 현황"
        style={{ 
          marginBottom: 24,
          backgroundColor: '#fffbe6',
          border: '1px solid #ffe58f'
        }}
        extra={
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleExportOrdersToExcel}
            disabled={ordersStatsLoading || !ordersStatsData?.data || ordersStatsData.data.length === 0}
          >
            주문 엑셀 다운로드
          </Button>
        }
      >
        {ordersStatsLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin size="large" />
            <div style={{ marginTop: 16, color: '#666', fontSize: 14 }}>주문 정보를 불러오는 중...</div>
          </div>
        ) : (
          <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: 16,
            justifyContent: 'space-around',
            padding: '8px 0'
          }}>
            <div style={{ textAlign: 'center', minWidth: 100 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#d48806' }}>
                {orderStats.total}
              </div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>총 주문건수</div>
            </div>
            
            {/* 생성된 주문 - 강조 (클릭 가능) */}
            <div 
              onClick={() => handleGoToOrders('CREATED')}
              style={{ 
                textAlign: 'center', 
                minWidth: 120,
                padding: '12px 16px',
                backgroundColor: '#e6f7ff',
                border: '2px solid #1890ff',
                borderRadius: 8,
                boxShadow: '0 2px 8px rgba(24, 144, 255, 0.2)',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                position: 'relative' as const,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(24, 144, 255, 0.4)'
                e.currentTarget.style.borderColor = '#0050b3'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(24, 144, 255, 0.2)'
                e.currentTarget.style.borderColor = '#1890ff'
              }}
            >
              <div style={{ 
                fontSize: 32, 
                fontWeight: 900, 
                color: '#1890ff',
                textShadow: '0 1px 2px rgba(0,0,0,0.1)'
              }}>
                {orderStats.created}
              </div>
              <div style={{ 
                fontSize: 13, 
                color: '#1890ff', 
                marginTop: 6,
                fontWeight: 600
              }}>
                🆕 생성된 주문
              </div>
              <div style={{ 
                fontSize: 11, 
                color: '#1890ff', 
                marginTop: 4,
                opacity: 0.7
              }}>
                클릭하여 상세보기 →
              </div>
            </div>
            
            {/* 결제완료 - 강조 (클릭 가능) */}
            <div 
              onClick={() => handleGoToOrders('PAID')}
              style={{ 
                textAlign: 'center', 
                minWidth: 120,
                padding: '12px 16px',
                backgroundColor: '#f6ffed',
                border: '2px solid #52c41a',
                borderRadius: 8,
                boxShadow: '0 2px 8px rgba(82, 196, 26, 0.2)',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                position: 'relative' as const,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(82, 196, 26, 0.4)'
                e.currentTarget.style.borderColor = '#389e0d'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(82, 196, 26, 0.2)'
                e.currentTarget.style.borderColor = '#52c41a'
              }}
            >
              <div style={{ 
                fontSize: 32, 
                fontWeight: 900, 
                color: '#52c41a',
                textShadow: '0 1px 2px rgba(0,0,0,0.1)'
              }}>
                {orderStats.paid}
              </div>
              <div style={{ 
                fontSize: 13, 
                color: '#52c41a', 
                marginTop: 6,
                fontWeight: 600
              }}>
                ✅ 결제완료
              </div>
              <div style={{ 
                fontSize: 11, 
                color: '#52c41a', 
                marginTop: 4,
                opacity: 0.7
              }}>
                클릭하여 상세보기 →
              </div>
            </div>
            
            <div style={{ textAlign: 'center', minWidth: 100 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#d48806' }}>
                {orderStats.confirmed}
              </div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>주문확인</div>
            </div>
            <div style={{ textAlign: 'center', minWidth: 100 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#52c41a' }}>
                {orderStats.completed}
              </div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>완료</div>
            </div>
            <div style={{ textAlign: 'center', minWidth: 100 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#ff4d4f' }}>
                {orderStats.canceled}
              </div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>취소</div>
            </div>
          </div>
        )}
      </Card>

      {/* 매출 통계 카드 */}
      <Card 
        style={{ marginBottom: 24 }}
        extra={
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleExportSalesToExcel}
            disabled={currentSalesLoading || !currentSalesData?.data || currentSalesData.data.length === 0}
          >
            매출 엑셀 다운로드
          </Button>
        }
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>매출 현황</div>
            {salesStatsTab === 'daily' && (
              <DatePicker
                value={selectedDate}
                onChange={(date) => date && setSelectedDate(date)}
                format="YYYY-MM-DD"
                placeholder="날짜 선택"
              />
            )}
            {salesStatsTab === 'weekly' && (
              <DatePicker
                picker="week"
                value={dayjs(selectedWeek)}
                onChange={(date) => date && setSelectedWeek(date.startOf('week').format('YYYY-MM-DD'))}
                format="YYYY년 [W]주"
                placeholder="주 선택"
              />
            )}
            {salesStatsTab === 'monthly' && (
              <DatePicker
                picker="month"
                value={dayjs(selectedMonth)}
                onChange={(date) => date && setSelectedMonth(date.format('YYYY-MM'))}
                format="YYYY년 MM월"
                placeholder="월 선택"
              />
            )}
          </div>
          <Tabs
            activeKey={salesStatsTab}
            onChange={(key) => setSalesStatsTab(key as 'daily' | 'weekly' | 'monthly')}
            items={[
              { key: 'daily', label: '일별' },
              { key: 'weekly', label: '주별' },
              { key: 'monthly', label: '월별' },
            ]}
          />
          {currentSalesLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Spin size="large" />
              <div style={{ marginTop: 16, color: '#666', fontSize: 14 }}>매출 통계를 불러오는 중...</div>
            </div>
          ) : currentSalesData?.data && currentSalesData.data.length > 0 ? (
            <Table
              columns={[
                {
                  title: '기간',
                  dataIndex: 'periodStart',
                  key: 'periodStart',
                  width: 120,
                  render: (date: string) => {
                    if (salesStatsTab === 'daily') {
                      return dayjs(date).format('YYYY-MM-DD')
                    } else if (salesStatsTab === 'weekly') {
                      return dayjs(date).format('YYYY-MM-DD') + ' (주)'
                    } else {
                      return dayjs(date).format('YYYY-MM')
                    }
                  },
                },
                {
                  title: '카드',
                  key: 'card',
                  children: [
                    {
                      title: '건수',
                      dataIndex: ['card', 'count'],
                      key: 'cardCount',
                      align: 'right' as const,
                      width: 80,
                    },
                    {
                      title: '금액',
                      dataIndex: ['card', 'net'],
                      key: 'cardNet',
                      render: (amount: number) => new Intl.NumberFormat('ko-KR').format(amount) + '원',
                      align: 'right' as const,
                      width: 120,
                    },
                  ],
                },
                {
                  title: '무통장',
                  key: 'bankTransfer',
                  children: [
                    {
                      title: '건수',
                      dataIndex: ['bankTransfer', 'count'],
                      key: 'bankCount',
                      align: 'right' as const,
                      width: 80,
                    },
                    {
                      title: '금액',
                      dataIndex: ['bankTransfer', 'net'],
                      key: 'bankNet',
                      render: (amount: number) => new Intl.NumberFormat('ko-KR').format(amount) + '원',
                      align: 'right' as const,
                      width: 120,
                    },
                  ],
                },
                {
                  title: '총매출',
                  key: 'total',
                  children: [
                    {
                      title: '건수',
                      dataIndex: ['total', 'count'],
                      key: 'totalCount',
                      align: 'right' as const,
                      width: 80,
                    },
                    {
                      title: '금액',
                      dataIndex: ['total', 'net'],
                      key: 'totalNet',
                      render: (amount: number) => (
                        <strong>{new Intl.NumberFormat('ko-KR').format(amount)}원</strong>
                      ),
                      align: 'right' as const,
                      width: 140,
                    },
                  ],
                },
              ]}
              dataSource={currentSalesData.data}
              rowKey="periodStart"
              pagination={false}
              size="small"
              scroll={{ x: 'max-content' }}
            />
          ) : (
            <div style={{ color: '#999', textAlign: 'center', padding: '40px 0' }}>
              매출 통계 데이터가 없습니다.
            </div>
          )}
        </Space>
      </Card>


    </div>
  )
}

export default Dashboard
