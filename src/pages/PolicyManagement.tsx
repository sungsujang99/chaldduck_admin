import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card,
  Tabs,
  Button,
  Space,
  Typography,
  Table,
  Modal,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Switch,
  Select,
  message,
  Tag,
} from 'antd'
import { PlusOutlined, ReloadOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import { apiService } from '@/services/api'
import type {
  ShippingPolicyCreateRequest,
  ShippingPolicyResponse,
  ShippingRuleCreateRequest,
  ShippingRuleResponse,
  DiscountPolicyCreateRequest,
  DiscountPolicyResponse,
  DiscountRuleCreateRequest,
  DiscountRuleResponse,
} from '@/types/api'

const { Title } = Typography
const { RangePicker } = DatePicker

const PolicyManagement = () => {
  const queryClient = useQueryClient()
  const [shippingPolicyForm] = Form.useForm()
  const [shippingRuleForm] = Form.useForm()
  const [discountPolicyForm] = Form.useForm()
  const [discountRuleForm] = Form.useForm()
  const [activeTab, setActiveTab] = useState('shipping')
  const [isShippingPolicyModalOpen, setIsShippingPolicyModalOpen] = useState(false)
  const [isShippingRuleModalOpen, setIsShippingRuleModalOpen] = useState(false)
  const [selectedShippingPolicyId, setSelectedShippingPolicyId] = useState<number | null>(null)
  const [isDiscountPolicyModalOpen, setIsDiscountPolicyModalOpen] = useState(false)
  const [isDiscountRuleModalOpen, setIsDiscountRuleModalOpen] = useState(false)
  const [selectedDiscountPolicyId, setSelectedDiscountPolicyId] = useState<number | null>(null)
  const [editingFreeOverAmount, setEditingFreeOverAmount] = useState<{ ruleId: number; policyId: number } | null>(null)
  const [editingFreeOverAmountValue, setEditingFreeOverAmountValue] = useState<string>('')
  
  // 우편번호 -> 지역명 매핑 (주요 우편번호만 표시)
  const getRegionFromZipCode = (zipCode?: string): string => {
    if (!zipCode) return '-'
    
    // 앞 3자리 기준으로 대략적인 지역 표시
    const prefix = zipCode.substring(0, 3)
    const zipPrefixMap: Record<string, string> = {
      '010': '서울 도봉구',
      '011': '서울 노원구',
      '012': '서울 동대문구',
      '013': '서울 중랑구',
      '014': '서울 성북구',
      '015': '서울 강북구',
      '020': '서울 은평구',
      '021': '서울 서대문구',
      '030': '서울 종로구',
      '031': '서울 용산구',
      '032': '서울 중구',
      '033': '서울 성동구',
      '034': '서울 광진구',
      '040': '서울 마포구',
      '041': '서울 양천구',
      '042': '서울 강서구',
      '050': '서울 구로구',
      '051': '서울 금천구',
      '052': '서울 영등포구',
      '053': '서울 동작구',
      '054': '서울 관악구',
      '060': '서울 강남구',
      '061': '서울 서초구',
      '062': '서울 강동구',
      '063': '서울 송파구',
      '130': '경기 수원시',
      '131': '경기 수원시',
      '132': '경기 용인시',
      '133': '경기 성남시',
      '134': '경기 성남시',
      '135': '경기 안양시',
      '136': '경기 광명시',
      '137': '경기 과천시',
      '138': '경기 의왕시',
      '139': '경기 군포시',
      '140': '경기 부천시',
      '141': '경기 부천시',
      '142': '경기 광주시',
      '143': '경기 하남시',
      '144': '경기 남양주시',
      '145': '경기 구리시',
      '146': '경기 고양시',
      '147': '경기 고양시',
      '148': '경기 파주시',
      '149': '경기 김포시',
      '150': '경기 양주시',
      '151': '경기 의정부시',
      '152': '경기 포천시',
      '153': '경기 가평군',
      '154': '경기 연천군',
      '155': '경기 동두천시',
      '156': '경기 안산시',
      '157': '경기 시흥시',
      '158': '경기 평택시',
      '159': '경기 안성시',
      '160': '경기 화성시',
      '161': '경기 오산시',
      '162': '경기 이천시',
      '163': '경기 여주시',
      '164': '경기 양평군',
      '165': '강원 춘천시',
      '166': '강원 원주시',
      '210': '인천 중구',
      '211': '인천 동구',
      '212': '인천 미추홀구',
      '213': '인천 연수구',
      '214': '인천 남동구',
      '215': '인천 부평구',
      '216': '인천 계양구',
      '217': '인천 서구',
      '218': '인천 강화군',
      '219': '인천 옹진군',
      '300': '대전 동구',
      '301': '대전 중구',
      '302': '대전 서구',
      '303': '대전 유성구',
      '304': '대전 대덕구',
      '400': '광주 동구',
      '401': '광주 서구',
      '402': '광주 남구',
      '403': '광주 북구',
      '404': '광주 광산구',
      '410': '울산 중구',
      '411': '울산 남구',
      '412': '울산 동구',
      '413': '울산 북구',
      '414': '울산 울주군',
      '420': '세종특별자치시',
      '600': '부산 중구',
      '601': '부산 서구',
      '602': '부산 동구',
      '603': '부산 영도구',
      '604': '부산 부산진구',
      '605': '부산 동래구',
      '606': '부산 남구',
      '607': '부산 북구',
      '608': '부산 해운대구',
      '609': '부산 사하구',
      '610': '부산 금정구',
      '611': '부산 강서구',
      '612': '부산 연제구',
      '613': '부산 수영구',
      '614': '부산 사상구',
      '615': '부산 기장군',
      '700': '대구 중구',
      '701': '대구 동구',
      '702': '대구 서구',
      '703': '대구 남구',
      '704': '대구 북구',
      '705': '대구 수성구',
      '706': '대구 달서구',
      '707': '대구 달성군',
    }
    
    return zipPrefixMap[prefix] || `우편번호 ${zipCode}`
  }

  // Shipping Policies Query
  const { data: shippingPoliciesData, isLoading: isLoadingShippingPolicies, refetch: refetchShippingPolicies } = useQuery({
    queryKey: ['shippingPolicies'],
    queryFn: () => apiService.getShippingPolicies(),
    retry: false,
  })

  // Discount Policies Query
  const { data: discountPoliciesData, isLoading: isLoadingDiscountPolicies, refetch: refetchDiscountPolicies } = useQuery({
    queryKey: ['discountPolicies'],
    queryFn: () => apiService.getDiscountPolicies(),
    retry: false,
  })

  // Shipping Policy Mutation
  const createShippingPolicyMutation = useMutation({
    mutationFn: (data: ShippingPolicyCreateRequest) => apiService.createShippingPolicy(data),
    onSuccess: () => {
      message.success('배송비 정책이 생성되었습니다.')
      setIsShippingPolicyModalOpen(false)
      shippingPolicyForm.resetFields()
      refetchShippingPolicies()
    },
    onError: (error: any) => {
      console.error('[PolicyManagement] 배송비 정책 생성 에러:', error.response?.data || error.message)
      const errorMessage = error.response?.data?.message || error.response?.data?.error || '배송비 정책 생성에 실패했습니다.'
      message.error(errorMessage)
    },
  })

  // Shipping Rule Mutation
  const createShippingRuleMutation = useMutation({
    mutationFn: (data: ShippingRuleCreateRequest) => apiService.createShippingRule(data),
    onSuccess: () => {
      message.success('배송비 룰이 생성되었습니다.')
      setIsShippingRuleModalOpen(false)
      setSelectedShippingPolicyId(null)
      shippingRuleForm.resetFields()
      refetchShippingPolicies()
    },
    onError: (error: any) => {
      console.error('[PolicyManagement] 배송비 룰 생성 에러 상세:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data,
        requestData: error.config?.data ? JSON.parse(error.config.data) : 'N/A',
        message: error.message,
        fullError: error,
      });
      
      // 서버 에러 메시지 추출
      let errorMessage = '배송비 룰 생성에 실패했습니다.';
      if (error.response?.data) {
        if (error.response.data.message) {
          errorMessage = error.response.data.message;
        } else if (error.response.data.error) {
          errorMessage = error.response.data.error;
        } else {
          errorMessage = `서버 오류 (${error.response.status}): ${JSON.stringify(error.response.data)}`;
        }
      }
      
      message.error({
        content: errorMessage,
        duration: 5,
      });
      
      // 개발 환경에서는 상세 정보도 표시
      if (import.meta.env.DEV) {
        console.error('[PolicyManagement] 요청 데이터:', error.config?.data ? JSON.parse(error.config.data) : 'N/A');
        console.error('[PolicyManagement] 응답 데이터:', error.response?.data);
      }
    },
  })

  // Discount Policy Mutation
  const createDiscountPolicyMutation = useMutation({
    mutationFn: (data: DiscountPolicyCreateRequest) => apiService.createDiscountPolicy(data),
    onSuccess: () => {
      message.success('할인 정책이 생성되었습니다.')
      setIsDiscountPolicyModalOpen(false)
      discountPolicyForm.resetFields()
      refetchDiscountPolicies()
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '할인 정책 생성에 실패했습니다.')
    },
  })

  // Discount Rule Mutation
  const createDiscountRuleMutation = useMutation({
    mutationFn: (data: DiscountRuleCreateRequest) => apiService.createDiscountRule(data),
    onSuccess: () => {
      message.success('할인 룰이 생성되었습니다.')
      setIsDiscountRuleModalOpen(false)
      setSelectedDiscountPolicyId(null)
      discountRuleForm.resetFields()
      refetchDiscountPolicies()
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '할인 룰 생성에 실패했습니다.')
    },
  })

  // Delete Mutations
  const deleteShippingPolicyMutation = useMutation({
    mutationFn: (policyId: number) => apiService.deleteShippingPolicy(policyId),
    onSuccess: () => {
      message.success('배송비 정책이 삭제되었습니다.')
      refetchShippingPolicies()
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '배송비 정책 삭제에 실패했습니다.')
    },
  })

  const deleteShippingRuleMutation = useMutation({
    mutationFn: (ruleId: number) => apiService.deleteShippingRule(ruleId),
    onSuccess: () => {
      message.success('배송비 룰이 삭제되었습니다.')
      refetchShippingPolicies()
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '배송비 룰 삭제에 실패했습니다.')
    },
  })

  const deleteDiscountPolicyMutation = useMutation({
    mutationFn: (policyId: number) => apiService.deleteDiscountPolicy(policyId),
    onSuccess: () => {
      message.success('할인 정책이 삭제되었습니다.')
      refetchDiscountPolicies()
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '할인 정책 삭제에 실패했습니다.')
    },
  })

  const deleteDiscountRuleMutation = useMutation({
    mutationFn: (ruleId: number) => apiService.deleteDiscountRule(ruleId),
    onSuccess: () => {
      message.success('할인 룰이 삭제되었습니다.')
      refetchDiscountPolicies()
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '할인 룰 삭제에 실패했습니다.')
    },
  })

  const handleDeleteShippingPolicy = (policyId: number) => {
    Modal.confirm({
      title: '배송비 정책 삭제',
      content: '정책에 속한 룰도 함께 삭제됩니다. 정말 삭제하시겠습니까?',
      onOk: () => {
        deleteShippingPolicyMutation.mutate(policyId)
      },
    })
  }

  const handleDeleteShippingRule = (ruleId: number) => {
    Modal.confirm({
      title: '배송비 룰 삭제',
      content: '정말 삭제하시겠습니까?',
      onOk: () => {
        deleteShippingRuleMutation.mutate(ruleId)
      },
    })
  }

  const handleDeleteDiscountPolicy = (policyId: number) => {
    Modal.confirm({
      title: '할인 정책 삭제',
      content: '정책에 속한 룰도 함께 삭제됩니다. 정말 삭제하시겠습니까?',
      onOk: () => {
        deleteDiscountPolicyMutation.mutate(policyId)
      },
    })
  }

  const handleDeleteDiscountRule = (ruleId: number) => {
    Modal.confirm({
      title: '할인 룰 삭제',
      content: '정말 삭제하시겠습니까?',
      onOk: () => {
        deleteDiscountRuleMutation.mutate(ruleId)
      },
    })
  }

  const handleShippingPolicySubmit = () => {
    shippingPolicyForm.validateFields().then((values) => {
      const [startAt, endAt] = values.dateRange as [Dayjs, Dayjs]
      // API 스펙: date-time 형식 (ISO 8601)
      // 예시: "2026-01-01T00:00:00"
      // 서버가 타임존 없이 기대할 수 있으므로 로컬 시간대 형식으로 시도
      // 만약 실패하면 UTC 형식도 시도 가능
      const requestData = {
        name: values.name,
        startAt: startAt.format('YYYY-MM-DDTHH:mm:ss'),
        endAt: endAt.format('YYYY-MM-DDTHH:mm:ss'),
        active: values.active ?? true,
      }
      console.log('[PolicyManagement] 배송비 정책 생성 요청 데이터:', JSON.stringify(requestData, null, 2))
      console.log('[PolicyManagement] 날짜 상세:', {
        startAt_raw: startAt.toString(),
        startAt_formatted: startAt.format('YYYY-MM-DDTHH:mm:ss'),
        endAt_raw: endAt.toString(),
        endAt_formatted: endAt.format('YYYY-MM-DDTHH:mm:ss'),
      })
      createShippingPolicyMutation.mutate(requestData)
    }).catch((error) => {
      console.error('[PolicyManagement] 폼 검증 에러:', error)
      message.error('입력값을 확인해주세요.')
    })
  }

  const handleShippingRuleSubmit = () => {
    shippingRuleForm.validateFields().then((values) => {
      console.log('[PolicyManagement] 폼 검증 완료, 원본 값:', values);
      
      // 숫자 필드 정규화 (InputNumber는 null을 반환할 수 있음)
      const policyId = Number(values.policyId);
      if (isNaN(policyId) || policyId <= 0) {
        message.error('유효한 정책 ID를 입력해주세요.')
        return
      }
      
      // 타입별 필수 필드 검증
      let zipPrefix: string | undefined = undefined
      let fee: number | undefined = undefined
      let freeOverAmount: number | undefined = undefined
      
      if (values.type === 'ZIP_PREFIX_FEE') {
        // ZIP_PREFIX_FEE 타입은 zipPrefix(전체 우편번호)와 fee가 필요
        if (!values.zipPrefix || values.zipPrefix.trim() === '') {
          message.error('우편번호를 입력해주세요.')
          return
        }
        if (values.fee === undefined || values.fee === null || values.fee < 0) {
          message.error('배송비를 입력해주세요.')
          return
        }
        zipPrefix = values.zipPrefix.trim()
        fee = Number(values.fee)
      } else if (values.type === 'FREE_OVER_AMOUNT') {
        // FREE_OVER_AMOUNT 타입은 freeOverAmount가 필요
        if (values.freeOverAmount === undefined || values.freeOverAmount === null || values.freeOverAmount < 0) {
          message.error('무료배송 금액을 입력해주세요.')
          return
        }
        freeOverAmount = Number(values.freeOverAmount)
      } else if (values.type === 'DEFAULT_FEE') {
        // DEFAULT_FEE 타입은 fee가 필요
        if (values.fee === undefined || values.fee === null || values.fee < 0) {
          message.error('배송비를 입력해주세요.')
          return
        }
        fee = Number(values.fee)
      }
      
      // 최종 데이터 생성 (모든 필드 포함, 필수가 아니면 0)
      const data: ShippingRuleCreateRequest = {
        policyId: policyId,
        type: values.type,
        label: values.label.trim(),
        active: values.active !== undefined ? values.active : true,
        // 모든 필드 포함 (필수가 아니면 기본값 설정)
        // zipPrefix는 빈 문자열이 아닐 때만 포함
        ...(zipPrefix !== undefined && zipPrefix !== '' ? { zipPrefix } : {}),
        fee: fee !== undefined ? fee : 0,
        freeOverAmount: freeOverAmount !== undefined ? freeOverAmount : 0,
      }
      
      // 최종 데이터 검증
      console.log('[PolicyManagement] 배송비 룰 생성 최종 요청 데이터:', JSON.stringify(data, null, 2))
      console.log('[PolicyManagement] 데이터 검증:', {
        policyId: data.policyId,
        type: data.type,
        label: data.label,
        zipPrefix: data.zipPrefix,
        fee: data.fee,
        freeOverAmount: data.freeOverAmount,
        active: data.active,
      })
      
      createShippingRuleMutation.mutate(data)
    }).catch((error) => {
      console.error('[PolicyManagement] 폼 검증 에러:', error)
      message.error('입력값을 확인해주세요.')
    })
  }

  const handleDiscountPolicySubmit = () => {
    discountPolicyForm.validateFields().then((values) => {
      const [startAt, endAt] = values.dateRange as [Dayjs, Dayjs]
      // API 스펙: date-time 형식 (ISO 8601)
      // 예시: "2026-01-01T00:00:00"
      // 서버가 타임존 없이 기대할 수 있으므로 로컬 시간대 형식으로 시도
      const requestData = {
        name: values.name,
        startAt: startAt.format('YYYY-MM-DDTHH:mm:ss'),
        endAt: endAt.format('YYYY-MM-DDTHH:mm:ss'),
        active: values.active ?? true,
      }
      console.log('[PolicyManagement] 할인 정책 생성 요청 데이터:', JSON.stringify(requestData, null, 2))
      createDiscountPolicyMutation.mutate(requestData)
    }).catch((error) => {
      console.error('[PolicyManagement] 폼 검증 에러:', error)
      message.error('입력값을 확인해주세요.')
    })
  }

  const handleDiscountRuleSubmit = () => {
    discountRuleForm.validateFields().then((values) => {
      console.log('[PolicyManagement] 할인 룰 폼 검증 완료, 원본 값:', values);
      
      // 필수 필드 검증
      const policyId = Number(values.policyId);
      if (isNaN(policyId) || policyId <= 0) {
        message.error('유효한 정책 ID를 입력해주세요.')
        return
      }
      
      const targetProductId = Number(values.targetProductId);
      if (isNaN(targetProductId) || targetProductId <= 0) {
        message.error('유효한 상품 ID를 입력해주세요.')
        return
      }
      
      const data: DiscountRuleCreateRequest = {
        policyId: policyId,
        type: values.type,
        targetProductId: targetProductId,
        label: values.label.trim(),
        applyScope: values.applyScope ?? 'ALL',
        active: values.active ?? true,
      }
      
      // 타입별 필수 필드 추가
      if (values.type === 'BANK_TRANSFER_RATE' || values.type === 'QTY_RATE') {
        // RATE 타입은 discountRate가 필요하고 amountOff는 0으로 설정
        if (values.discountRate === undefined || values.discountRate === null) {
          message.error('할인율을 입력해주세요.')
          return
        }
        const discountRate = Number(values.discountRate);
        if (isNaN(discountRate) || discountRate < 0 || discountRate > 100) {
          message.error('할인율은 0~100 사이의 값을 입력해주세요.')
          return
        }
        data.discountRate = discountRate
        data.amountOff = 0 // RATE 타입일 때는 amountOff를 0으로 설정
      } else if (values.type === 'BANK_TRANSFER_FIXED' || values.type === 'QTY_FIXED') {
        // FIXED 타입은 amountOff가 필요하고 discountRate는 0으로 설정
        if (values.amountOff === undefined || values.amountOff === null) {
          message.error('할인 금액을 입력해주세요.')
          return
        }
        const amountOff = Number(values.amountOff);
        if (isNaN(amountOff) || amountOff < 0) {
          message.error('할인 금액은 0 이상의 값을 입력해주세요.')
          return
        }
        data.amountOff = amountOff
        data.discountRate = 0 // FIXED 타입일 때는 discountRate를 0으로 설정
      }
      
      // 선택적 필드 추가 (undefined/null/빈 문자열이 아닐 때만)
      if (values.minAmount !== undefined && values.minAmount !== null && values.minAmount !== '') {
        const minAmount = Number(values.minAmount);
        if (!isNaN(minAmount) && minAmount >= 0) {
          data.minAmount = minAmount
        }
      }
      if (values.minQty !== undefined && values.minQty !== null && values.minQty !== '') {
        const minQty = Number(values.minQty);
        if (!isNaN(minQty) && minQty >= 0) {
          data.minQty = minQty
        }
      }
      
      // 최종 데이터 정리 (모든 필드 포함, 필수가 아니면 0)
      const cleanedData: DiscountRuleCreateRequest = {
        policyId: data.policyId,
        type: data.type,
        targetProductId: data.targetProductId,
        label: data.label,
        applyScope: data.applyScope || 'ALL',
        active: data.active,
        // 모든 필드 포함 (필수가 아니면 기본값 설정)
        discountRate: data.discountRate !== undefined ? data.discountRate : 0,
        amountOff: data.amountOff !== undefined ? data.amountOff : 0,
        minAmount: data.minAmount !== undefined ? data.minAmount : 0,
        minQty: data.minQty !== undefined ? data.minQty : 0,
      }
      
      // 최종 데이터 검증
      console.log('[PolicyManagement] 할인 룰 생성 최종 요청 데이터:', JSON.stringify(cleanedData, null, 2))
      console.log('[PolicyManagement] 데이터 검증:', {
        policyId: cleanedData.policyId,
        targetProductId: cleanedData.targetProductId,
        type: cleanedData.type,
        label: cleanedData.label,
        hasDiscountRate: cleanedData.discountRate !== undefined,
        hasAmountOff: cleanedData.amountOff !== undefined,
        discountRate: cleanedData.discountRate,
        amountOff: cleanedData.amountOff,
        minAmount: cleanedData.minAmount,
        minQty: cleanedData.minQty,
        active: cleanedData.active,
      })
      
      createDiscountRuleMutation.mutate(cleanedData)
    }).catch((error) => {
      console.error('[PolicyManagement] 폼 검증 에러:', error)
      message.error('입력값을 확인해주세요.')
    })
  }

  const shippingPolicyColumns = [
    {
      title: '정책 ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
    },
    {
      title: '정책명',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '시작일',
      dataIndex: 'startAt',
      key: 'startAt',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '종료일',
      dataIndex: 'endAt',
      key: 'endAt',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '상태',
      dataIndex: 'active',
      key: 'active',
      width: 100,
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'red'}>{active ? '활성' : '비활성'}</Tag>
      ),
    },
    {
      title: '작업',
      key: 'actions',
      width: 150,
      render: (_: any, record: ShippingPolicyResponse) => (
        <Space>
          <Button
            type="link"
            icon={<PlusOutlined />}
            onClick={() => {
              setSelectedShippingPolicyId(record.id)
              shippingRuleForm.setFieldsValue({ policyId: record.id })
              setIsShippingRuleModalOpen(true)
            }}
          >
            룰 추가
          </Button>
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteShippingPolicy(record.id)}
            loading={deleteShippingPolicyMutation.isPending}
          >
            삭제
          </Button>
        </Space>
      ),
    },
  ]

  const shippingRuleColumns = [
    {
      title: '룰 ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
    },
    {
      title: '정책 ID',
      dataIndex: 'policyId',
      key: 'policyId',
      width: 100,
    },
    {
      title: '타입',
      dataIndex: 'type',
      key: 'type',
      width: 150,
      render: (type: string) => {
        const typeMap: Record<string, string> = {
          ZIP_PREFIX_FEE: '지역별 배송비',
          FREE_OVER_AMOUNT: '무료배송 금액',
          DEFAULT_FEE: '기본 배송비',
        }
        return typeMap[type] || type
      },
    },
    {
      title: '라벨',
      dataIndex: 'label',
      key: 'label',
    },
    {
      title: '우편번호',
      dataIndex: 'zipPrefix',
      key: 'zipPrefix',
      render: (zipPrefix: string) => {
        if (!zipPrefix) return '-'
        const regionName = getRegionFromZipCode(zipPrefix)
        return (
          <Space direction="vertical" size={0}>
            <Space>
              <Tag color="blue" style={{ fontWeight: 'bold' }}>{zipPrefix}</Tag>
              {regionName !== `우편번호 ${zipPrefix}` && (
                <Typography.Text strong>{regionName}</Typography.Text>
              )}
            </Space>
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              (우편번호 기준)
            </Typography.Text>
          </Space>
        )
      },
    },
    {
      title: '배송비',
      dataIndex: 'fee',
      key: 'fee',
      render: (fee: number) => fee !== undefined ? `${fee.toLocaleString()}원` : '-',
    },
    {
      title: '무료배송 금액',
      dataIndex: 'freeOverAmount',
      key: 'freeOverAmount',
      render: (amount: number, record: ShippingRuleResponse & { policyId?: number }) => {
        const isEditing = editingFreeOverAmount?.ruleId === record.id
        if (isEditing) {
          return (
            <Space>
              <InputNumber
                value={Number(editingFreeOverAmountValue)}
                onChange={(val) => setEditingFreeOverAmountValue(String(val ?? 0))}
                onPressEnter={() => {
                  // TODO: API 추가 필요 - 무료배송 금액 업데이트
                  message.info('무료배송 금액 업데이트 API가 필요합니다.')
                  setEditingFreeOverAmount(null)
                  setEditingFreeOverAmountValue('')
                }}
                autoFocus
                size="small"
                style={{ width: 120 }}
                min={0}
                formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={(value) => Number(value!.replace(/\$\s?|(,*)/g, ''))}
              />
              <Button
                size="small"
                type="primary"
                onClick={() => {
                  message.info('무료배송 금액 업데이트 API가 필요합니다.')
                  setEditingFreeOverAmount(null)
                  setEditingFreeOverAmountValue('')
                }}
              >
                저장
              </Button>
              <Button
                size="small"
                onClick={() => {
                  setEditingFreeOverAmount(null)
                  setEditingFreeOverAmountValue('')
                }}
              >
                취소
              </Button>
            </Space>
          )
        }
        return (
          <span
            onDoubleClick={() => {
              setEditingFreeOverAmount({ ruleId: record.id, policyId: record.policyId || 0 })
              setEditingFreeOverAmountValue(String(amount ?? 0))
            }}
            style={{ cursor: 'pointer', padding: '4px 8px', display: 'inline-block' }}
            title="더블클릭하여 수정"
          >
            {amount !== undefined ? `${amount.toLocaleString()}원` : '-'}
          </span>
        )
      },
    },
    {
      title: '상태',
      dataIndex: 'active',
      key: 'active',
      width: 100,
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'red'}>{active ? '활성' : '비활성'}</Tag>
      ),
    },
    {
      title: '작업',
      key: 'actions',
      width: 100,
      render: (_: any, record: ShippingRuleResponse & { policyId?: number }) => (
        <Button
          type="link"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleDeleteShippingRule(record.id)}
          loading={deleteShippingRuleMutation.isPending}
        >
          삭제
        </Button>
      ),
    },
  ]

  const discountPolicyColumns = [
    {
      title: '정책 ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
    },
    {
      title: '정책명',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '시작일',
      dataIndex: 'startAt',
      key: 'startAt',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '종료일',
      dataIndex: 'endAt',
      key: 'endAt',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '상태',
      dataIndex: 'active',
      key: 'active',
      width: 100,
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'red'}>{active ? '활성' : '비활성'}</Tag>
      ),
    },
    {
      title: '작업',
      key: 'actions',
      width: 100,
      render: (_: any, record: DiscountPolicyResponse) => (
        <Button
          type="link"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleDeleteDiscountPolicy(record.id)}
          loading={deleteDiscountPolicyMutation.isPending}
        >
          삭제
        </Button>
      ),
    },
  ]

  const discountRuleColumns = [
    {
      title: '룰 ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
    },
    {
      title: '정책 ID',
      dataIndex: 'policyId',
      key: 'policyId',
      width: 100,
    },
    {
      title: '타입',
      dataIndex: 'type',
      key: 'type',
      width: 150,
      render: (type: string) => {
        const typeMap: Record<string, string> = {
          BANK_TRANSFER_FIXED: '무통장 고정할인',
          QTY_FIXED: '수량 고정할인',
          BANK_TRANSFER_RATE: '무통장 비율할인',
          QTY_RATE: '수량 비율할인',
        }
        return typeMap[type] || type
      },
    },
    {
      title: '라벨',
      dataIndex: 'label',
      key: 'label',
    },
    {
      title: '상품 ID',
      dataIndex: 'targetProductId',
      key: 'targetProductId',
      render: (id: number) => id || '전체',
    },
    {
      title: '할인율',
      dataIndex: 'discountRate',
      key: 'discountRate',
      render: (rate: number) => rate !== undefined ? `${rate}%` : '-',
    },
    {
      title: '할인금액',
      dataIndex: 'amountOff',
      key: 'amountOff',
      render: (amount: number) => amount !== undefined ? `${amount.toLocaleString()}원` : '-',
    },
    {
      title: '최소금액',
      dataIndex: 'minAmount',
      key: 'minAmount',
      render: (amount: number) => amount !== undefined ? `${amount.toLocaleString()}원` : '-',
    },
    {
      title: '최소수량',
      dataIndex: 'minQty',
      key: 'minQty',
      render: (qty: number) => qty !== undefined ? qty : '-',
    },
    {
      title: '상태',
      dataIndex: 'active',
      key: 'active',
      width: 100,
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'red'}>{active ? '활성' : '비활성'}</Tag>
      ),
    },
    {
      title: '작업',
      key: 'actions',
      width: 100,
      render: (_: any, record: DiscountRuleResponse & { policyId?: number }) => (
        <Button
          type="link"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleDeleteDiscountRule(record.id)}
          loading={deleteDiscountRuleMutation.isPending}
        >
          삭제
        </Button>
      ),
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Title level={2} style={{ margin: 0 }}>정책 관리</Title>
        <Space wrap>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={() => {
              // 모든 관련 쿼리 무효화 후 강제로 다시 불러오기
              queryClient.invalidateQueries({ queryKey: ['shippingPolicies'] })
              queryClient.invalidateQueries({ queryKey: ['discountPolicies'] })
              queryClient.refetchQueries({ queryKey: ['shippingPolicies'] })
              queryClient.refetchQueries({ queryKey: ['discountPolicies'] })
              refetchShippingPolicies()
              refetchDiscountPolicies()
            }}
            loading={isLoadingShippingPolicies || isLoadingDiscountPolicies}
          >
            새로고침
          </Button>
        </Space>
      </div>

      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <Tabs.TabPane tab="배송비 정책" key="shipping">
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Space wrap>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsShippingPolicyModalOpen(true)}>
                    배송비 정책 생성
                  </Button>
                </Space>
              </div>
              <Card title="배송비 정책 목록" size="small">
                <Table
                  columns={shippingPolicyColumns}
                  dataSource={shippingPoliciesData?.data || []}
                  rowKey="id"
                  loading={isLoadingShippingPolicies}
                  pagination={{ pageSize: 10 }}
                  locale={{ emptyText: '등록된 배송비 정책이 없습니다.' }}
                  expandable={{
                    expandedRowRender: (record: ShippingPolicyResponse) => (
                      <div style={{ margin: 0, paddingLeft: 24 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <Typography.Text strong>
                            배송비 룰 목록 ({record.rules?.length || 0}개)
                          </Typography.Text>
                          <Button
                            type="primary"
                            size="small"
                            icon={<PlusOutlined />}
                            onClick={() => {
                              setSelectedShippingPolicyId(record.id)
                              shippingRuleForm.setFieldsValue({ policyId: record.id })
                              setIsShippingRuleModalOpen(true)
                            }}
                          >
                            룰 추가
                          </Button>
                        </div>
                        {record.rules && record.rules.length > 0 ? (
                          <Table
                            columns={shippingRuleColumns}
                            dataSource={record.rules.map(rule => ({ ...rule, policyId: record.id }))}
                            rowKey="id"
                            pagination={false}
                            size="small"
                            locale={{ emptyText: '등록된 배송비 룰이 없습니다.' }}
                          />
                        ) : (
                          <Typography.Text type="secondary">등록된 배송비 룰이 없습니다.</Typography.Text>
                        )}
                      </div>
                    ),
                    rowExpandable: () => true,
                  }}
                />
              </Card>
            </Space>
          </Tabs.TabPane>

          <Tabs.TabPane tab="할인 정책" key="discount">
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Space wrap>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsDiscountPolicyModalOpen(true)}>
                    할인 정책 생성
                  </Button>
                </Space>
              </div>
              <Card title="할인 정책 목록" size="small">
                <Table
                  columns={discountPolicyColumns}
                  dataSource={discountPoliciesData?.data || []}
                  rowKey="id"
                  loading={isLoadingDiscountPolicies}
                  pagination={{ pageSize: 10 }}
                  locale={{ emptyText: '등록된 할인 정책이 없습니다.' }}
                  expandable={{
                    expandedRowRender: (record: DiscountPolicyResponse) => (
                      <div style={{ margin: 0, paddingLeft: 24 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <Typography.Text strong>
                            할인 룰 목록 ({record.rules?.length || 0}개)
                          </Typography.Text>
                          <Button
                            type="primary"
                            size="small"
                            icon={<PlusOutlined />}
                            onClick={() => {
                              setSelectedDiscountPolicyId(record.id)
                              discountRuleForm.setFieldsValue({ policyId: record.id })
                              setIsDiscountRuleModalOpen(true)
                            }}
                          >
                            룰 추가
                          </Button>
                        </div>
                        {record.rules && record.rules.length > 0 ? (
                          <Table
                            columns={discountRuleColumns}
                            dataSource={record.rules.map(rule => ({ ...rule, policyId: record.id }))}
                            rowKey="id"
                            pagination={false}
                            size="small"
                            locale={{ emptyText: '등록된 할인 룰이 없습니다.' }}
                          />
                        ) : (
                          <Typography.Text type="secondary">등록된 할인 룰이 없습니다.</Typography.Text>
                        )}
                      </div>
                    ),
                    rowExpandable: () => true,
                  }}
                />
              </Card>
            </Space>
          </Tabs.TabPane>
        </Tabs>
      </Card>

      {/* 배송비 정책 생성 모달 */}
      <Modal
        title="배송비 정책 생성"
        open={isShippingPolicyModalOpen}
        onOk={handleShippingPolicySubmit}
        onCancel={() => {
          setIsShippingPolicyModalOpen(false)
          shippingPolicyForm.resetFields()
        }}
        confirmLoading={createShippingPolicyMutation.isPending}
        width={600}
      >
        <Form form={shippingPolicyForm} layout="vertical">
          <Form.Item
            label="정책명"
            name="name"
            rules={[{ required: true, message: '정책명을 입력해주세요.' }]}
          >
            <Input placeholder="예: 일반 배송 정책" />
          </Form.Item>
          <Form.Item
            label="적용 기간"
            name="dateRange"
            rules={[{ required: true, message: '적용 기간을 선택해주세요.' }]}
          >
            <RangePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="활성화" name="active" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="활성" unCheckedChildren="비활성" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 배송비 룰 생성 모달 */}
      <Modal
        title="배송비 룰 생성"
        open={isShippingRuleModalOpen}
        onOk={handleShippingRuleSubmit}
        onCancel={() => {
          setIsShippingRuleModalOpen(false)
          setSelectedShippingPolicyId(null)
          shippingRuleForm.resetFields()
        }}
        confirmLoading={createShippingRuleMutation.isPending}
        width={600}
      >
        <Form form={shippingRuleForm} layout="vertical">
          <Form.Item
            label="정책"
            name="policyId"
            rules={[{ required: true, message: '정책을 선택해주세요.' }]}
          >
            <Select 
              placeholder="정책 선택" 
              disabled={selectedShippingPolicyId !== null}
            >
              {shippingPoliciesData?.data?.map(policy => (
                <Select.Option key={policy.id} value={policy.id}>
                  {policy.name} (ID: {policy.id})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label="타입"
            name="type"
            rules={[{ required: true, message: '타입을 선택해주세요.' }]}
          >
            <Select placeholder="타입 선택">
              <Select.Option value="ZIP_PREFIX_FEE">지역별 배송비</Select.Option>
              <Select.Option value="FREE_OVER_AMOUNT">무료배송 금액</Select.Option>
              <Select.Option value="DEFAULT_FEE">기본 배송비</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            label="라벨"
            name="label"
            rules={[{ required: true, message: '라벨을 입력해주세요.' }]}
          >
            <Input placeholder="예: 서울 특별시 강남구 배송비" />
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.type !== currentValues.type}
          >
            {({ getFieldValue }) => {
              const type = getFieldValue('type')
              return (
                <>
                  {type === 'ZIP_PREFIX_FEE' && (
                    <>
                      <Form.Item
                        label={
                          <Space>
                            <span>우편번호 접두사</span>
                            <Tag color="blue">전체 우편번호 5자리</Tag>
                          </Space>
                        }
                        name="zipPrefix"
                        rules={[
                          { required: true, message: '우편번호를 입력해주세요.' },
                          { pattern: /^\d{5}$/, message: '우편번호는 5자리 숫자입니다. (예: 06035, 06236)' },
                        ]}
                        extra="주소 검색 버튼을 클릭하여 주소를 자동으로 불러올 수 있습니다."
                      >
                        <Space.Compact style={{ width: '100%' }}>
                          <Input placeholder="예: 060 (강남구), 062 (강동구)" maxLength={3} />
                          <Button
                            onClick={() => {
                              // Daum Postcode API를 사용한 주소 검색
                              const daum = (window as any).daum
                              if (daum && daum.Postcode) {
                                new daum.Postcode({
                                  oncomplete: (data: any) => {
                                    // 우편번호 전체를 저장
                                    const fullZipCode = data.zonecode || ''
                                    shippingRuleForm.setFieldsValue({
                                      zipPrefix: fullZipCode,
                                    })
                                    message.success(`우편번호 ${fullZipCode}이(가) 설정되었습니다.`)
                                  },
                                }).open()
                              } else {
                                // Daum Postcode 스크립트가 없으면 수동 입력 안내
                                message.info('주소 검색 기능을 사용하려면 페이지를 새로고침해주세요.')
                              }
                            }}
                          >
                            주소 검색
                          </Button>
                        </Space.Compact>
                      </Form.Item>
                      <Form.Item
                        label="배송비"
                        name="fee"
                        rules={[{ required: true, message: '배송비를 입력해주세요.' }]}
                      >
                        <InputNumber style={{ width: '100%' }} placeholder="2500" min={0} />
                      </Form.Item>
                    </>
                  )}
                  {type === 'FREE_OVER_AMOUNT' && (
                    <Form.Item
                      label="무료배송 금액"
                      name="freeOverAmount"
                      rules={[{ required: true, message: '무료배송 금액을 입력해주세요.' }]}
                    >
                      <InputNumber style={{ width: '100%' }} placeholder="50000" min={0} />
                    </Form.Item>
                  )}
                  {type === 'DEFAULT_FEE' && (
                    <Form.Item
                      label={
                        <Space>
                          <span>기본 배송비</span>
                          <Tag color="green">공통 적용</Tag>
                        </Space>
                      }
                      name="fee"
                      rules={[{ required: true, message: '배송비를 입력해주세요.' }]}
                      extra="기본 배송비 정책은 공통으로 적용됩니다. 특정 지역(우편번호) 정책과 중복 추가 가능합니다."
                    >
                      <InputNumber style={{ width: '100%' }} placeholder="2500" min={0} />
                    </Form.Item>
                  )}
                </>
              )
            }}
          </Form.Item>
          <Form.Item label="활성화" name="active" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="활성" unCheckedChildren="비활성" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 할인 정책 생성 모달 */}
      <Modal
        title="할인 정책 생성"
        open={isDiscountPolicyModalOpen}
        onOk={handleDiscountPolicySubmit}
        onCancel={() => {
          setIsDiscountPolicyModalOpen(false)
          discountPolicyForm.resetFields()
        }}
        confirmLoading={createDiscountPolicyMutation.isPending}
        width={600}
      >
        <Form form={discountPolicyForm} layout="vertical">
          <Form.Item
            label="정책명"
            name="name"
            rules={[{ required: true, message: '정책명을 입력해주세요.' }]}
          >
            <Input placeholder="예: 무통장/수량 할인 프로모션" />
          </Form.Item>
          <Form.Item
            label="적용 기간"
            name="dateRange"
            rules={[{ required: true, message: '적용 기간을 선택해주세요.' }]}
          >
            <RangePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="활성화" name="active" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="활성" unCheckedChildren="비활성" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 할인 룰 생성 모달 */}
      <Modal
        title="할인 룰 생성"
        open={isDiscountRuleModalOpen}
        onOk={handleDiscountRuleSubmit}
        onCancel={() => {
          setIsDiscountRuleModalOpen(false)
          setSelectedDiscountPolicyId(null)
          discountRuleForm.resetFields()
        }}
        confirmLoading={createDiscountRuleMutation.isPending}
        width={600}
      >
        <Form form={discountRuleForm} layout="vertical">
          <Form.Item
            label="정책"
            name="policyId"
            rules={[{ required: true, message: '정책을 선택해주세요.' }]}
          >
            <Select 
              placeholder="정책 선택" 
              disabled={selectedDiscountPolicyId !== null}
            >
              {discountPoliciesData?.data?.map(policy => (
                <Select.Option key={policy.id} value={policy.id}>
                  {policy.name} (ID: {policy.id})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label="타입"
            name="type"
            rules={[{ required: true, message: '타입을 선택해주세요.' }]}
          >
            <Select placeholder="타입 선택">
              <Select.Option value="BANK_TRANSFER_FIXED">무통장 고정할인</Select.Option>
              <Select.Option value="QTY_FIXED">수량 고정할인</Select.Option>
              <Select.Option value="BANK_TRANSFER_RATE">무통장 비율할인</Select.Option>
              <Select.Option value="QTY_RATE">수량 비율할인</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            label="적용 범위"
            name="applyScope"
            rules={[{ required: true, message: '적용 범위를 선택해주세요.' }]}
            initialValue="ALL"
          >
            <Select placeholder="적용 범위 선택">
              <Select.Option value="ALL">전체 (배송 + 픽업)</Select.Option>
              <Select.Option value="PICKUP">픽업 전용</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            label="라벨"
            name="label"
            rules={[{ required: true, message: '라벨을 입력해주세요.' }]}
          >
            <Input placeholder="예: 무통장 할인" />
          </Form.Item>
          <Form.Item
            label="상품 ID"
            name="targetProductId"
            rules={[
              { required: true, message: '상품 ID를 입력해주세요.' },
              { type: 'number', min: 1, message: '1 이상의 값을 입력해주세요.' },
            ]}
          >
            <InputNumber style={{ width: '100%' }} placeholder="상품 ID" min={1} />
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.type !== currentValues.type}
          >
            {({ getFieldValue }) => {
              const type = getFieldValue('type')
              return (
                <>
                  {(type === 'BANK_TRANSFER_RATE' || type === 'QTY_RATE') && (
                    <Form.Item
                      label="할인율 (%)"
                      name="discountRate"
                      rules={[
                        { required: true, message: '할인율을 입력해주세요.' },
                        { type: 'number', min: 0, max: 100, message: '0~100 사이의 값을 입력해주세요.' },
                      ]}
                    >
                      <InputNumber style={{ width: '100%' }} placeholder="10" min={0} max={100} />
                    </Form.Item>
                  )}
                  {(type === 'BANK_TRANSFER_FIXED' || type === 'QTY_FIXED') && (
                    <Form.Item
                      label="할인금액"
                      name="amountOff"
                      rules={[
                        { required: true, message: '할인금액을 입력해주세요.' },
                        { type: 'number', min: 0, message: '0 이상의 값을 입력해주세요.' },
                      ]}
                    >
                      <InputNumber style={{ width: '100%' }} placeholder="4500" min={0} />
                    </Form.Item>
                  )}
                </>
              )
            }}
          </Form.Item>
          <Form.Item label="최소금액" name="minAmount">
            <InputNumber style={{ width: '100%' }} placeholder="30000" min={0} />
          </Form.Item>
          <Form.Item label="최소수량" name="minQty">
            <InputNumber style={{ width: '100%' }} placeholder="3" min={0} />
          </Form.Item>
          <Form.Item label="활성화" name="active" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="활성" unCheckedChildren="비활성" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default PolicyManagement
