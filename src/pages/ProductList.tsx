import { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card,
  Table,
  Button,
  Space,
  Typography,
  Tag,
  Modal,
  Form,
  Input,
  InputNumber,
  message,
  Tooltip,
  DatePicker,
  Switch,
  Select,
  Collapse,
  Checkbox,
} from 'antd'
import type { CheckboxChangeEvent } from 'antd/es/checkbox'
import { PlusOutlined, ReloadOutlined, DeleteOutlined, GiftOutlined, ExclamationCircleOutlined, OrderedListOutlined, HolderOutlined } from '@ant-design/icons'
import {
  DndContext,
  closestCenter,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Dayjs } from 'dayjs'
import { apiService } from '@/services/api'
import type { 
  AdminProductStockRow, 
  ProductCreateRequest, 
  StockUpdateRequest, 
  DiscountRuleResponse,
  DiscountPolicyCreateRequest,
  DiscountPolicyResponse,
  DiscountRuleCreateRequest,
  ProductReorderRequest,
  ProductOrderItem,
  AdminCategoryRow,
} from '@/types/api'

const { Title } = Typography
const { RangePicker } = DatePicker

// 카테고리 정의 (한글 이름과 설명 포함)
type CategoryInfo = {
  value: string
  label: string
  description?: string
  color: string
  active?: boolean
}

const DEFAULT_CATEGORIES: CategoryInfo[] = [
  { value: 'RICE_CAKE', label: '떡', color: 'magenta', description: '떡류 상품', active: true },
  { value: 'CAKE', label: '케이크', color: 'red', description: '케이크류 상품', active: true },
  { value: 'BREAD', label: '빵', color: 'volcano', description: '빵류 상품', active: true },
  { value: 'COOKIE', label: '쿠키', color: 'orange', description: '쿠키/과자류 상품', active: true },
  { value: 'CHOCOLATE', label: '초콜릿', color: 'gold', description: '초콜릿류 상품', active: true },
  { value: 'ICE_CREAM', label: '아이스크림', color: 'cyan', description: '아이스크림/빙과류 상품', active: true },
  { value: 'BEVERAGE', label: '음료', color: 'blue', description: '음료류 상품', active: true },
  { value: 'GIFT_SET', label: '선물세트', color: 'purple', description: '선물세트 상품', active: true },
  { value: 'OTHER', label: '기타', color: 'default', description: '기타 상품', active: true },
]

// localStorage에서 카테고리 설정 불러오기
const loadCategories = (): CategoryInfo[] => {
  try {
    const saved = localStorage.getItem('productCategories')
    if (saved) {
      return JSON.parse(saved)
    }
  } catch (e) {
    console.error('Failed to load categories:', e)
  }
  return DEFAULT_CATEGORIES
}

// localStorage에 카테고리 설정 저장 (이제 서버 데이터 사용하므로 미사용)
// const saveCategories = (categories: CategoryInfo[]) => {
//   try {
//     localStorage.setItem('productCategories', JSON.stringify(categories))
//   } catch (e) {
//     console.error('Failed to save categories:', e)
//   }
// }

const getCategoryInfo = (categoryValue?: string, categories?: CategoryInfo[]): CategoryInfo | undefined => {
  const cats = categories || DEFAULT_CATEGORIES
  return cats.find(c => c.value === categoryValue)
}

// 카테고리 + 상품 묶음 (전시 순서용)
type CategoryWithProducts = { category: AdminCategoryRow; products: AdminProductStockRow[] }

// 드래그 가능한 상품 아이템 (카테고리 내부용)
interface SortableProductItemProps {
  product: AdminProductStockRow
  index: number
  categories: CategoryInfo[]
}

// 드래그 가능한 카테고리 블록 (헤더 + 내부 상품들)
interface SortableCategoryBlockProps {
  categoryWithProducts: CategoryWithProducts
  categoryIndex: number
  categories: CategoryInfo[]
  onProductDragEnd: (event: DragEndEvent, categoryId: number) => void
}

const getCategorySortableId = (cwp: CategoryWithProducts) =>
  cwp.category.categoryId < 0 ? 'cat-uncat' : `cat-${cwp.category.categoryId}`

const SortableCategoryBlock = ({ categoryWithProducts, categoryIndex, categories, onProductDragEnd }: SortableCategoryBlockProps) => {
  const { category, products } = categoryWithProducts
  const sortableId = getCategorySortableId(categoryWithProducts)
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sortableId })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        marginBottom: 16,
        border: isDragging ? '2px solid #52c41a' : '1px solid #e8e8e8',
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: isDragging ? '#f6ffed' : '#fafafa',
        boxShadow: isDragging ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
      }}
    >
      {/* 카테고리 헤더 - 드래그로 카테고리 순서 변경 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '12px 16px',
          backgroundColor: '#f0f9eb',
          cursor: 'grab',
          borderBottom: '1px solid #e8e8e8',
        }}
        {...attributes}
        {...listeners}
      >
        <HolderOutlined style={{ color: '#999', fontSize: 16, marginRight: 8 }} />
        <Tag color="green" style={{ minWidth: 28, textAlign: 'center', fontWeight: 'bold' }}>
          {categoryIndex + 1}
        </Tag>
        <Typography.Text strong style={{ fontSize: 14 }}>{category.name}</Typography.Text>
        <Typography.Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
          ({products.length}개 상품)
        </Typography.Text>
      </div>
      {/* 카테고리 내 상품 목록 - 드래그로 상품 순서 변경 */}
      <div style={{ padding: '8px 12px 12px' }}>
        {products.length > 0 ? (
          <DndContext
            sensors={useSensors(
              useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
              useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
            )}
            collisionDetection={closestCenter}
            onDragEnd={(e) => onProductDragEnd(e, category.categoryId)}
          >
            <SortableContext
              items={products.map(p => p.productId)}
              strategy={verticalListSortingStrategy}
            >
              {products.map((product, idx) => (
                <SortableProductItem
                  key={product.productId}
                  product={product}
                  index={idx}
                  categories={categories}
                />
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          <Typography.Text type="secondary" style={{ fontSize: 12, padding: '8px 0' }}>
            전시 중인 상품이 없습니다.
          </Typography.Text>
        )}
      </div>
    </div>
  )
}

const SortableProductItem = ({ product, index, categories }: SortableProductItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: product.productId })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(value)
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        marginBottom: 8,
        border: isDragging ? '2px solid #1890ff' : '1px solid #d9d9d9',
        borderRadius: 8,
        backgroundColor: isDragging ? '#e6f7ff' : (index % 2 === 0 ? '#fafafa' : '#fff'),
        cursor: 'grab',
        boxShadow: isDragging ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
      }}
      {...attributes}
      {...listeners}
    >
      <Space size="middle">
        <HolderOutlined style={{ color: '#999', fontSize: 16 }} />
        <Tag color="blue" style={{ minWidth: 32, textAlign: 'center', fontWeight: 'bold' }}>
          {index + 1}
        </Tag>
        <Typography.Text strong style={{ fontSize: 14 }}>{product.name}</Typography.Text>
        {(product.categoryCode || product.category) && (
          <Tag color={getCategoryInfo(product.categoryCode || product.category, categories)?.color}>
            {product.categoryName || getCategoryInfo(product.categoryCode || product.category, categories)?.label}
          </Tag>
        )}
      </Space>
      <Typography.Text type="secondary" style={{ fontSize: 13 }}>
        {formatCurrency(product.price)}
      </Typography.Text>
    </div>
  )
}

const ProductList = () => {
  const [form] = Form.useForm()
  const [stockForm] = Form.useForm()
  const [discountPolicyForm] = Form.useForm()
  const [discountRuleForm] = Form.useForm()
  const [editProductForm] = Form.useForm()
  const queryClient = useQueryClient()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isStockModalOpen, setIsStockModalOpen] = useState(false)
  const [isDiscountPolicyModalOpen, setIsDiscountPolicyModalOpen] = useState(false)
  const [isDiscountRuleModalOpen, setIsDiscountRuleModalOpen] = useState(false)
  const [isEditProductModalOpen, setIsEditProductModalOpen] = useState(false)
  const [selectedDiscountPolicyId, setSelectedDiscountPolicyId] = useState<number | null>(null)
  const [checkedPolicyIds, setCheckedPolicyIds] = useState<number[]>([])
  const [editingProduct, setEditingProduct] = useState<AdminProductStockRow | null>(null)
  const [_addingRuleProductId, setAddingRuleProductId] = useState<number | null>(null)
  const [editingCell, setEditingCell] = useState<{ productId: number; field: string } | null>(null)
  const [editingValue, setEditingValue] = useState<string>('')
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false)
  const [selectedProductForOrder, setSelectedProductForOrder] = useState<AdminProductStockRow | null>(null)
  const [orderForm] = Form.useForm()
  const [isCategoryManagementOpen, setIsCategoryManagementOpen] = useState(false)
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | 'ALL'>('ALL')
  const [categories] = useState<CategoryInfo[]>(loadCategories())  // 로컬 카테고리 (일부 기능에서 사용)
  const [editingServerCategory, setEditingServerCategory] = useState<AdminCategoryRow | null>(null)
  const [categoryEditForm] = Form.useForm()
  // 상품 전시 순서 변경 관련 상태 (카테고리 안에 상품 포함)
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false)
  const [reorderData, setReorderData] = useState<CategoryWithProducts[]>([])
  const [isSavingReorder, setIsSavingReorder] = useState(false)
  // 상품 선택 관련 상태
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)

  const { data: productsData, isLoading, error, refetch } = useQuery({
    queryKey: ['products'],
    queryFn: () => apiService.getProducts(),
    retry: (failureCount, error: any) => {
      // 500 에러는 최대 2번 재시도
      if (error?.response?.status === 500 && failureCount < 2) {
        return true;
      }
      return false;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    meta: {
      errorMessage: '상품 목록을 불러오는데 실패했습니다.',
    },
  })

  // 서버 카테고리 조회
  const { data: serverCategoriesData } = useQuery({
    queryKey: ['adminCategories'],
    queryFn: () => apiService.getAdminCategories(),
    retry: false,
  })
  
  const serverCategories = serverCategoriesData?.data || []

  // 할인 정책 조회
  const { data: discountPoliciesData, refetch: refetchDiscountPolicies } = useQuery({
    queryKey: ['discountPolicies'],
    queryFn: () => apiService.getDiscountPolicies(),
    retry: false,
  })

  // 각 상품에 적용된 할인 정책 찾기
  const getProductDiscounts = useMemo(() => {
    const discounts: Record<number, DiscountRuleResponse[]> = {}
    if (discountPoliciesData?.data) {
      discountPoliciesData.data.forEach((policy) => {
        if (policy.active && policy.rules) {
          policy.rules.forEach((rule) => {
            if (rule.active && rule.targetProductId) {
              if (!discounts[rule.targetProductId]) {
                discounts[rule.targetProductId] = []
              }
              discounts[rule.targetProductId].push(rule)
            }
          })
        }
      })
    }
    return discounts
  }, [discountPoliciesData?.data])

  // 무통장 할인 rule 찾기 (PICKUP 제외)
  const getBankTransferRule = (product: AdminProductStockRow): DiscountRuleResponse | null => {
    const productDiscounts = getProductDiscounts[product.productId] || []
    return productDiscounts.find(
      (rule) => (rule.type === 'BANK_TRANSFER_RATE' || rule.type === 'BANK_TRANSFER_FIXED') && rule.applyScope !== 'PICKUP'
    ) || null
  }

  // 무통장 할인 가격 계산
  const getBankTransferPrice = (product: AdminProductStockRow): number | null => {
    const bankTransferDiscount = getBankTransferRule(product)
    
    if (!bankTransferDiscount) return null
    
    if (bankTransferDiscount.type === 'BANK_TRANSFER_RATE' && bankTransferDiscount.discountRate) {
      return Math.floor(product.price * (1 - bankTransferDiscount.discountRate / 100))
    } else if (bankTransferDiscount.type === 'BANK_TRANSFER_FIXED' && bankTransferDiscount.amountOff) {
      return product.price - bankTransferDiscount.amountOff
    }
    
    return null
  }

  // 수량 할인 정보 가져오기
  const getQtyDiscount = (product: AdminProductStockRow): DiscountRuleResponse | null => {
    const productDiscounts = getProductDiscounts[product.productId] || []
    const qtyDiscount = productDiscounts.find(
      (rule) => (rule.type === 'QTY_RATE' || rule.type === 'QTY_FIXED') && rule.applyScope !== 'PICKUP'
    )
    return qtyDiscount || null
  }

  // 픽업 할인 rule 찾기
  const getPickupDiscountRule = (product: AdminProductStockRow): DiscountRuleResponse | null => {
    const productDiscounts = getProductDiscounts[product.productId] || []
    return productDiscounts.find(
      (rule) => rule.applyScope === 'PICKUP' && rule.active
    ) || null
  }

  // 픽업 할인 가격 계산
  const getPickupDiscountPrice = (product: AdminProductStockRow): { discountedPrice: number; discountRate: number } | null => {
    const pickupDiscount = getPickupDiscountRule(product)
    
    if (!pickupDiscount) return null
    
    let discountedPrice = product.price
    
    if (pickupDiscount.type === 'BANK_TRANSFER_RATE' && pickupDiscount.discountRate) {
      discountedPrice = Math.floor(product.price * (1 - pickupDiscount.discountRate / 100))
    } else if (pickupDiscount.type === 'BANK_TRANSFER_FIXED' && pickupDiscount.amountOff) {
      discountedPrice = product.price - pickupDiscount.amountOff
    } else if (pickupDiscount.type === 'QTY_RATE' && pickupDiscount.discountRate) {
      discountedPrice = Math.floor(product.price * (1 - pickupDiscount.discountRate / 100))
    } else if (pickupDiscount.type === 'QTY_FIXED' && pickupDiscount.amountOff) {
      discountedPrice = product.price - pickupDiscount.amountOff
    }
    
    const discountRate = Math.round(((product.price - discountedPrice) / product.price) * 100)
    
    return { discountedPrice, discountRate }
  }

  const createProductMutation = useMutation({
    mutationFn: (data: ProductCreateRequest) => apiService.createProduct(data),
    onSuccess: () => {
      message.success('상품이 등록되었습니다.')
      setIsModalOpen(false)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '상품 등록에 실패했습니다.')
    },
  })

  const updateStockMutation = useMutation({
    mutationFn: ({ productId, data }: { productId: number; data: StockUpdateRequest }) =>
      apiService.updateProductStock(productId, data),
    onSuccess: () => {
      message.success('재고가 수정되었습니다.')
      setIsStockModalOpen(false)
      setEditingProduct(null)
      stockForm.resetFields()
      
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '재고 수정에 실패했습니다.')
    },
  })

  // 상품 전시 ON/OFF (active 토글)
  const toggleProductDisplayMutation = useMutation({
    mutationFn: ({ productId, active }: { productId: number; active: boolean }) => 
      apiService.updateProduct(productId, { active }),
    onSuccess: (_, variables: { productId: number; active: boolean }) => {
      message.success(variables.active ? '상품이 전시되었습니다.' : '상품이 숨겨졌습니다.')
      queryClient.invalidateQueries({ queryKey: ['products'] })
      refetch()
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '상품 전시 상태 변경에 실패했습니다.')
    },
  })

  // 상품 삭제 (soft delete)
  const deleteProductMutation = useMutation({
    mutationFn: (productId: number) => apiService.deleteProduct(productId),
    onSuccess: () => {
      message.success('상품이 삭제되었습니다.')
      queryClient.invalidateQueries({ queryKey: ['products'] })
      refetch()
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '상품 삭제에 실패했습니다.')
    },
  })

  const handleToggleProductDisplay = (productId: number, productName: string, currentActive: boolean) => {
    const action = currentActive ? '숨기기' : '전시하기'
    const description = currentActive 
      ? '상품을 숨기면 고객에게 보이지 않습니다. (재고는 유지됩니다)'
      : '상품을 전시하면 고객에게 다시 보입니다.'
    
    Modal.confirm({
      title: `상품 ${action}`,
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p><strong>"{productName}"</strong> 상품을 {action}시겠습니까?</p>
          <p style={{ color: currentActive ? '#faad14' : '#52c41a', fontSize: 12 }}>
            {description}
          </p>
        </div>
      ),
      okText: action,
      cancelText: '취소',
      okButtonProps: { danger: currentActive },
      onOk: () => {
        toggleProductDisplayMutation.mutate({ productId, active: !currentActive })
      },
    })
  }

  const handleDeleteProduct = (productId: number, productName: string) => {
    Modal.confirm({
      title: '상품 삭제',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p><strong>"{productName}"</strong> 상품을 삭제하시겠습니까?</p>
          <p style={{ color: '#ff4d4f', fontSize: 12 }}>
            ⚠️ 삭제된 상품은 목록에서 숨겨지며, 데이터베이스에는 보관됩니다.
          </p>
        </div>
      ),
      okText: '삭제',
      cancelText: '취소',
      okButtonProps: { danger: true },
      onOk: () => {
        deleteProductMutation.mutate(productId)
      },
    })
  }

  // 상품 정보 수정
  const editProductMutation = useMutation({
    mutationFn: ({ productId, data }: { productId: number; data: any }) => 
      apiService.updateProduct(productId, data),
    onSuccess: () => {
      message.success('상품 정보가 수정되었습니다.')
      setIsEditProductModalOpen(false)
      setEditingProduct(null)
      editProductForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['products'] })
      refetch()
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '상품 수정에 실패했습니다.')
    },
  })

  // 상품 일괄 상태 변경
  const bulkUpdateActiveStateMutation = useMutation({
    mutationFn: async ({ productIds, active }: { productIds: number[]; active: boolean }) => {
      await Promise.all(
        productIds.map(productId => 
          apiService.updateProduct(productId, { active })
        )
      )
      return { productIds, active }
    },
    onSuccess: ({ productIds, active }) => {
      message.success(`${productIds.length}개 상품이 ${active ? '활성화' : '비활성화'}되었습니다.`)
      setSelectedProductIds([])
      queryClient.invalidateQueries({ queryKey: ['products'] })
      refetch()
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '상태 변경에 실패했습니다.')
    },
  })

  // 할인 정책 생성
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

  // 할인 룰 생성
  const createDiscountRuleMutation = useMutation({
    mutationFn: (data: DiscountRuleCreateRequest) => apiService.createDiscountRule(data),
    onSuccess: () => {
      message.success('할인 룰이 생성되었습니다.')
      setIsDiscountRuleModalOpen(false)
      setSelectedDiscountPolicyId(null)
      setAddingRuleProductId(null)
      discountRuleForm.resetFields()
      refetchDiscountPolicies()
    },
    onError: (error: any) => {
      console.error('[ProductList] 할인 룰 생성 에러 상세:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data,
        requestData: error.config?.data ? JSON.parse(error.config.data) : 'N/A',
        message: error.message,
        fullError: error,
      });
      
      // 서버 에러 메시지 추출
      let errorMessage = '할인 룰 생성에 실패했습니다.';
      if (error.response?.data) {
        const responseData = error.response.data;
        if (responseData.message) {
          errorMessage = responseData.message;
        } else if (responseData.error) {
          errorMessage = responseData.error;
        } else if (responseData.exception) {
          errorMessage = `서버 오류: ${responseData.exception}`;
        } else if (error.response.status === 500) {
          errorMessage = '서버 내부 오류가 발생했습니다. 서버 관리자에게 문의하세요.';
        } else {
          errorMessage = `서버 오류 (${error.response.status}): ${JSON.stringify(responseData)}`;
        }
        
        // 필드별 에러가 있으면 추가 정보 표시
        if (responseData.errors && Array.isArray(responseData.errors)) {
          const fieldErrors = responseData.errors.map((e: any) => e.defaultMessage || e.message).join(', ');
          if (fieldErrors) {
            errorMessage += ` (${fieldErrors})`;
          }
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      message.error({
        content: errorMessage,
        duration: 5,
      });
      
      // 개발 환경에서는 상세 정보도 표시
      if (import.meta.env.DEV) {
        console.error('[ProductList] 요청 데이터:', error.config?.data ? JSON.parse(error.config.data) : 'N/A');
        console.error('[ProductList] 응답 데이터:', error.response?.data);
      }
    },
  })

  // 할인 정책 삭제
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

  // 할인 룰 삭제
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

  // 상품 정렬 순서 변경
  const reorderProductsMutation = useMutation({
    mutationFn: (data: ProductReorderRequest) => apiService.reorderProducts(data),
    onSuccess: () => {
      message.success('상품 순서가 변경되었습니다.')
      setIsReorderModalOpen(false)
      setReorderData([])
      queryClient.invalidateQueries({ queryKey: ['products'] })
      refetch()
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '상품 순서 변경에 실패했습니다.')
    },
  })

  const handleAddProduct = () => {
    form.resetFields()
    setIsModalOpen(true)
  }

  // 드래그 앤 드롭 센서 설정
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // 상품 목록 → 카테고리별 그룹 데이터 생성 (테이블 순서 반영)
  const buildReorderDataFromProducts = (products: AdminProductStockRow[]): CategoryWithProducts[] => {
    const activeProductsList = products.filter(p => !p.deletedAt)
    const displayProductsList = activeProductsList.filter(p => p.active !== false)
    const sortedProducts = [...displayProductsList].sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999))
    const categoryMap = new Map<string | number, AdminCategoryRow>()
    serverCategories.filter(c => c.active !== false).forEach(cat => {
      categoryMap.set(cat.categoryId, cat)
      categoryMap.set(cat.code, cat)
    })
    const categoryOrder: AdminCategoryRow[] = []
    const seen = new Set<number>()
    for (const p of sortedProducts) {
      const cat = p.categoryId != null ? categoryMap.get(p.categoryId) : categoryMap.get(p.categoryCode || '')
      if (cat && !seen.has(cat.categoryId)) {
        seen.add(cat.categoryId)
        categoryOrder.push(cat)
      }
    }
    const uncategorized = sortedProducts.filter(p => {
      const cat = p.categoryId != null ? categoryMap.get(p.categoryId) : categoryMap.get(p.categoryCode || '')
      return !cat
    })
    if (uncategorized.length > 0) {
      categoryOrder.push({ categoryId: -1, code: 'UNCATEGORIZED', name: '미분류', active: true, sortOrder: 999 })
    }
    serverCategories.filter(c => c.active !== false && !seen.has(c.categoryId)).forEach(cat => {
      categoryOrder.push(cat)
    })
    return categoryOrder.map(cat => ({
      category: cat,
      products: cat.categoryId < 0 ? uncategorized : sortedProducts.filter(p => p.categoryId === cat.categoryId || p.categoryCode === cat.code),
    }))
  }

  // 상품 순서 변경 모달 열기 - 캐시 데이터로 즉시 오픈 (로딩 지연 방지)
  const handleOpenReorderModal = () => {
    const products = productsData?.data || []
    const data = buildReorderDataFromProducts(products)
    setReorderData(data)
    reorderDataRef.current = data
    setIsReorderModalOpen(true)
  }

  // reorderData ref로 저장 시 최신값 보장 (드래그 후 즉시 저장 시 state 미반영 방지)
  const reorderDataRef = useRef<CategoryWithProducts[]>([])
  useEffect(() => {
    reorderDataRef.current = reorderData
  }, [reorderData])

  // 카테고리 드래그 완료 (카테고리 블록 전체 이동)
  // over.id가 상품 ID(숫자)일 수 있음: 내부 DndContext 영역에 드롭 시 → 해당 상품의 카테고리로 인식
  const handleCategoryDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setReorderData(prev => {
      const oldIdx = prev.findIndex(d => getCategorySortableId(d) === active.id)
      let newIdx = prev.findIndex(d => getCategorySortableId(d) === over.id)
      if (newIdx < 0 && typeof over.id === 'number') {
        const cwp = prev.find(d => d.products.some(p => p.productId === over.id))
        if (cwp) newIdx = prev.findIndex(d => getCategorySortableId(d) === getCategorySortableId(cwp))
      }
      if (oldIdx >= 0 && newIdx >= 0) {
        return arrayMove(prev, oldIdx, newIdx)
      }
      return prev
    })
  }

  // 상품 드래그 완료 (카테고리 내에서만 순서 변경)
  const handleProductDragEnd = (event: DragEndEvent, categoryId: number) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setReorderData(prev =>
      prev.map(cwp => {
        if (cwp.category.categoryId !== categoryId) return cwp
        const oldIdx = cwp.products.findIndex(p => p.productId === active.id)
        const newIdx = cwp.products.findIndex(p => p.productId === over.id)
        if (oldIdx < 0 || newIdx < 0) return cwp
        return { ...cwp, products: arrayMove(cwp.products, oldIdx, newIdx) }
      })
    )
  }

  // 상품·카테고리 순서 저장
  // API는 전체 상품 목록 전송 권장 → 전시 OFF 상품도 끝에 포함
  // reorderDataRef 사용: 카테고리 드래그 직후 저장 시 state 미반영 방지
  const handleSaveReorder = async () => {
    const dataToSave = reorderDataRef.current
    const items: ProductOrderItem[] = []
    let sortOrder = 1
    dataToSave.forEach(cwp => {
      cwp.products.forEach(p => {
        items.push({ productId: p.productId, sortOrder })
        sortOrder++
      })
    })
    // 전시 OFF 상품도 포함 (API 전체 목록 권장)
    const displayIds = new Set(items.map(i => i.productId))
    const hidden = activeProducts
      .filter(p => !displayIds.has(p.productId))
      .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999))
    hidden.forEach(p => {
      items.push({ productId: p.productId, sortOrder })
      sortOrder++
    })

    if (items.length === 0) {
      message.warning('저장할 상품이 없습니다.')
      return
    }

    setIsSavingReorder(true)
    try {
      // 1. 카테고리 sortOrder 저장 (병렬)
      const realCategories = dataToSave.filter(d => d.category.categoryId > 0)
      await Promise.all(
        realCategories.map((cwp, i) =>
          apiService.updateCategory(cwp.category.categoryId, { sortOrder: i + 1 })
        )
      )
      // 2. 상품 sortOrder 저장
      await reorderProductsMutation.mutateAsync({ items })
      message.success('전시 순서가 저장되었습니다.')
      setIsReorderModalOpen(false)
      setReorderData([])
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['adminCategories'] })
      refetch()
      queryClient.refetchQueries({ queryKey: ['adminCategories'] })
    } catch (error: any) {
      console.error('[ProductList] 순서 저장 실패:', error)
      message.error(error?.response?.data?.message || '순서 저장에 실패했습니다.')
      throw error
    } finally {
      setIsSavingReorder(false)
    }
  }

  // const handleEditStock = (product: AdminProductStockRow) => {
  //   setEditingProduct(product)
  //   stockForm.setFieldsValue({
  //     stockQty: product.stockQty,
  //     safetyStock: product.safetyStock,
  //     memo: '',
  //   })
  //   setIsStockModalOpen(true)
  // }

  const handleModalOk = () => {
    form.validateFields().then((values) => {
      // 필수 필드만 포함한 최소 요청
      const requestData: ProductCreateRequest = {
        name: values.name,
        price: Number(values.price) || 0,
        initialStockQty: Number(values.initialStockQty) || 0,
        safetyStock: Number(values.safetyStock) || 0,
      }
      
      // 선택 필드는 값이 있을 때만
      if (values.purchasePrice) {
        requestData.purchasePrice = Number(values.purchasePrice)
      }
      // categoryId는 숫자로 전송 (카테고리 선택 시)
      if (values.categoryId) {
        requestData.categoryId = Number(values.categoryId)
      }
      if (values.taxType) {
        requestData.taxType = values.taxType
      }
      
      console.log('[handleModalOk] 상품 등록 요청 데이터:', JSON.stringify(requestData, null, 2))
      createProductMutation.mutate(requestData)
    })
  }

  // 상품 수정 모달 열기
  const handleEditProduct = (product: AdminProductStockRow) => {
    setEditingProduct(product)
    editProductForm.setFieldsValue({
      name: product.name,
      price: product.price,
      purchasePrice: product.purchasePrice,
      categoryId: product.categoryId,
      taxType: product.taxType,
    })
    setIsEditProductModalOpen(true)
  }

  // 상품 수정 제출
  const handleEditProductSubmit = () => {
    editProductForm.validateFields().then((values) => {
      if (!editingProduct) return

      const updateData: any = {}
      
      // 변경된 필드만 포함
      if (values.name && values.name !== editingProduct.name) {
        updateData.name = values.name
      }
      const nextPrice = values.price !== undefined ? Number(values.price) : undefined
      const nextPurchasePrice = values.purchasePrice !== undefined && values.purchasePrice !== null
        ? Number(values.purchasePrice)
        : undefined

      if (nextPrice !== undefined && nextPrice !== editingProduct.price) {
        updateData.price = nextPrice
      }
      if (nextPurchasePrice !== undefined && nextPurchasePrice !== (editingProduct.purchasePrice ?? undefined)) {
        updateData.purchasePrice = nextPurchasePrice
      }
      if (values.categoryId !== undefined && values.categoryId !== editingProduct.categoryId) {
        updateData.categoryId = values.categoryId
      }
      if (values.taxType && values.taxType !== editingProduct.taxType) {
        updateData.taxType = values.taxType
      }

      if (Object.keys(updateData).length === 0) {
        message.info('변경된 내용이 없습니다.')
        return
      }

      editProductMutation.mutate({
        productId: editingProduct.productId,
        data: updateData,
      })
    }).catch((error) => {
      console.error('[ProductList] 상품 수정 폼 검증 에러:', error)
      message.error('입력값을 확인해주세요.')
    })
  }

  const handleStockModalOk = () => {
    stockForm.validateFields().then((values) => {
      if (editingProduct) {
        updateStockMutation.mutate({
          productId: editingProduct.productId,
          data: {
            stockQty: values.stockQty,
            safetyStock: values.safetyStock,
            memo: values.memo,
          },
        })
      }
    })
  }

  const handleDiscountPolicySubmit = () => {
    discountPolicyForm.validateFields().then((values) => {
      const [startAt, endAt] = values.dateRange as [Dayjs, Dayjs]
      const requestData: DiscountPolicyCreateRequest = {
        name: values.name,
        startAt: startAt.format('YYYY-MM-DDTHH:mm:ss'),
        endAt: endAt.format('YYYY-MM-DDTHH:mm:ss'),
        active: values.active ?? true,
      }
      createDiscountPolicyMutation.mutate(requestData)
    })
  }

  const handleDiscountRuleSubmit = () => {
    discountRuleForm.validateFields().then((values) => {
      // 체크된 정책이 하나면 자동으로 사용, 아니면 폼에서 선택한 값 사용
      let policyId = selectedDiscountPolicyId
      if (!policyId && checkedPolicyIds.length === 1) {
        policyId = checkedPolicyIds[0]
      } else if (!policyId) {
        policyId = Number(values.policyId)
      }
      
      if (!policyId || isNaN(policyId) || policyId <= 0) {
        message.error('할인 정책을 선택해주세요. 상단에서 정책을 체크하거나 모달에서 선택하세요.')
        return
      }

      const data: DiscountRuleCreateRequest = {
        policyId,
        type: values.type,
        targetProductId: Number(values.targetProductId),
        label: values.label.trim(),
        applyScope: values.applyScope ?? 'ALL',
        active: values.active ?? true,
      }

      // 타입별 필수 필드 추가
      if (values.type === 'BANK_TRANSFER_RATE' || values.type === 'QTY_RATE') {
        if (values.discountRate === undefined || values.discountRate === null) {
          message.error('할인율을 입력해주세요.')
          return
        }
        const discountRate = Number(values.discountRate)
        if (isNaN(discountRate) || discountRate < 0 || discountRate > 100) {
          message.error('할인율은 0~100 사이의 값을 입력해주세요.')
          return
        }
        data.discountRate = discountRate
        data.amountOff = 0
      } else if (values.type === 'BANK_TRANSFER_FIXED' || values.type === 'QTY_FIXED') {
        if (values.amountOff === undefined || values.amountOff === null) {
          message.error('할인 금액을 입력해주세요.')
          return
        }
        const amountOff = Number(values.amountOff)
        if (isNaN(amountOff) || amountOff < 0) {
          message.error('할인 금액은 0 이상의 값을 입력해주세요.')
          return
        }
        data.amountOff = amountOff
        data.discountRate = 0
      }

      // 선택적 필드 추가 (서버 규격: null 허용 안 함, 모든 필드 명시)
      if (values.minAmount !== undefined && values.minAmount !== null && values.minAmount !== '') {
        const minAmount = Number(values.minAmount)
        if (!isNaN(minAmount) && minAmount >= 0) {
          // minAmount가 너무 작으면 경고 (1000원 미만)
          if (minAmount > 0 && minAmount < 1000) {
            console.warn('[ProductList] minAmount가 매우 작습니다:', minAmount);
          }
          data.minAmount = minAmount
        } else {
          data.minAmount = 0 // null 허용 안 함
        }
      } else {
        data.minAmount = 0 // null 허용 안 함
      }
      
      if (values.minQty !== undefined && values.minQty !== null && values.minQty !== '') {
        const minQty = Number(values.minQty)
        if (!isNaN(minQty) && minQty >= 0) {
          data.minQty = minQty
        } else {
          data.minQty = 0 // null 허용 안 함
        }
      } else {
        data.minQty = 0 // null 허용 안 함
      }

      // 최종 데이터 검증 로그
      console.log('[ProductList] 할인 룰 생성 최종 요청 데이터:', JSON.stringify(data, null, 2));
      
      createDiscountRuleMutation.mutate(data)
    }).catch((error) => {
      console.error('[ProductList] 할인 룰 폼 검증 에러:', error)
      message.error('입력값을 확인해주세요.')
    })
  }

  const handleDeleteDiscountPolicy = (policyId: number) => {
    Modal.confirm({
      title: '할인 정책 삭제',
      content: '정책에 속한 룰도 함께 삭제됩니다. 정말 삭제하시겠습니까?',
      onOk: () => deleteDiscountPolicyMutation.mutate(policyId),
    })
  }

  const handleDeleteDiscountRule = (ruleId: number) => {
    Modal.confirm({
      title: '할인 룰 삭제',
      content: '정말 삭제하시겠습니까?',
      onOk: () => deleteDiscountRuleMutation.mutate(ruleId),
    })
  }

  // const getSoldOutStatusColor = (status: string) => {
  //   switch (status) {
  //     case 'IN_STOCK':
  //       return 'green'
  //     case 'LOW_STOCK':
  //       return 'orange'
  //     case 'SOLD_OUT':
  //       return 'red'
  //     default:
  //       return 'default'
  //   }
  // }

  // const getSoldOutStatusText = (status: string) => {
  //   switch (status) {
  //     case 'IN_STOCK':
  //       return '재고 있음'
  //     case 'LOW_STOCK':
  //       return '재고 부족'
  //     case 'SOLD_OUT':
  //       return '품절'
  //     default:
  //       return status
  //   }
  // }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원'
  }

  // 더블클릭 편집 핸들러
  const handleCellDoubleClick = (productId: number, field: string, currentValue: number | string | boolean) => {
    setEditingCell({ productId, field })
    setEditingValue(String(currentValue))
  }

  // 셀 편집 저장
  const handleCellSave = async (productId: number, field: string) => {
    console.log('[handleCellSave] 호출됨:', { productId, field, editingValue })
    
    const product = activeProducts.find(p => p.productId === productId)
    if (!product) {
      console.log('[handleCellSave] 상품을 찾을 수 없음:', productId)
      return
    }

    const numValue = Number(editingValue)
    console.log('[handleCellSave] numValue:', numValue)

    if (field === 'bankTransferPrice') {
      // 무통장 할인 금액 저장 로직 (입력값 = 할인 금액)
      if (isNaN(numValue) || numValue < 0) {
        message.error('올바른 할인 금액을 입력해주세요.')
        return
      }
      
      if (numValue >= product.price) {
        message.error('할인 금액은 판매가보다 작아야 합니다.')
        return
      }

      // 입력값이 할인 금액
      const amountOff = numValue
      const discountedPrice = product.price - numValue

      // 상단에서 정책을 선택했는지 확인 (생성 시 필요)
      if (checkedPolicyIds.length === 0) {
        message.error('정책을 체크해주세요.')
        return
      }
      const selectedPolicyId = checkedPolicyIds[0]

      // 기존 무통장 할인 rule 찾기
      const existingRule = getBankTransferRule(product)

      // 새 룰 생성 데이터
      const newRuleData = {
        policyId: selectedPolicyId,
        label: `${product.name} 무통장 할인`,
        type: 'BANK_TRANSFER_FIXED' as const,
        targetProductId: productId,
        applyScope: 'ALL' as const,
        amountOff: amountOff,
        discountRate: 0,
        minAmount: discountedPrice,
        minQty: 1,
        active: true,
      };

      if (existingRule) {
        // 기존 룰 삭제 후 새로 생성
        console.log('[ProductList] 기존 무통장 할인 룰 삭제 후 재생성:', existingRule.id);
        deleteDiscountRuleMutation.mutate(existingRule.id, {
          onSuccess: () => {
            console.log('[ProductList] 삭제 성공, 새 룰 생성:', JSON.stringify(newRuleData, null, 2));
            createDiscountRuleMutation.mutate(newRuleData)
          },
          onError: (error: any) => {
            console.error('[ProductList] 삭제 실패:', error);
            message.error('기존 할인 룰 삭제에 실패했습니다.')
          }
        })
      } else {
        // 새 rule 생성
        console.log('[ProductList] 무통장 할인 룰 생성:', JSON.stringify(newRuleData, null, 2));
        createDiscountRuleMutation.mutate(newRuleData)
      }
      setEditingCell(null)
      setEditingValue('')
      return
    }

    if (field === 'pickupDiscountPrice') {
      // 픽업 할인 금액 저장 로직 (입력값 = 할인 금액)
      if (isNaN(numValue) || numValue < 0) {
        message.error('올바른 할인 금액을 입력해주세요.')
        return
      }
      
      if (numValue >= product.price) {
        message.error('할인 금액은 판매가보다 작아야 합니다.')
        return
      }

      // 입력값이 할인 금액
      const amountOff = numValue
      const discountedPrice = product.price - numValue

      // 상단에서 정책을 선택했는지 확인 (생성 시 필요)
      if (checkedPolicyIds.length === 0) {
        message.error('정책을 체크해주세요.')
        return
      }
      const selectedPolicyId = checkedPolicyIds[0]

      // 기존 픽업 할인 rule 찾기
      const existingRule = getPickupDiscountRule(product)

      // 새 룰 생성 데이터
      const newRuleData = {
        policyId: selectedPolicyId,
        label: `${product.name} 픽업 할인`,
        type: 'BANK_TRANSFER_FIXED' as const,
        targetProductId: productId,
        applyScope: 'PICKUP' as const,
        amountOff: amountOff,
        discountRate: 0,
        minAmount: discountedPrice,
        minQty: 1,
        active: true,
      };

      if (existingRule) {
        // 기존 룰 삭제 후 새로 생성
        console.log('[ProductList] 기존 픽업 할인 룰 삭제 후 재생성:', existingRule.id);
        deleteDiscountRuleMutation.mutate(existingRule.id, {
          onSuccess: () => {
            console.log('[ProductList] 삭제 성공, 새 룰 생성:', JSON.stringify(newRuleData, null, 2));
            createDiscountRuleMutation.mutate(newRuleData)
          },
          onError: (error: any) => {
            console.error('[ProductList] 삭제 실패:', error);
            message.error('기존 할인 룰 삭제에 실패했습니다.')
          }
        })
      } else {
        // 새 rule 생성
        console.log('[ProductList] 픽업 할인 룰 생성:', JSON.stringify(newRuleData, null, 2));
        createDiscountRuleMutation.mutate(newRuleData)
      }
      setEditingCell(null)
      setEditingValue('')
      return
    }

    // 상품 정보 수정 로직 (API 기반)
    if (field === 'price' || field === 'purchasePrice' || field === 'category' || field === 'taxType') {
      const updateData: any = {}

      switch (field) {
        case 'price':
          if (isNaN(numValue) || numValue <= 0) {
            message.error('올바른 판매가를 입력해주세요.')
            return
          }
          updateData.price = numValue
          break
        case 'purchasePrice':
          if (isNaN(numValue) || numValue < 0) {
            message.error('올바른 매입가를 입력해주세요.')
            return
          }
          updateData.purchasePrice = numValue
          break
        case 'category':
          console.log('[DEBUG] 카테고리 수정 시작:', { productId, field, editingValue, currentCategoryCode: product.categoryCode })
          updateData.categoryId = Number(editingValue)
          break
        case 'taxType':
          console.log('[DEBUG] 과세유형 수정 시작:', { productId, field, editingValue, currentTaxType: product.taxType })
          updateData.taxType = editingValue
          break
      }

      console.log('[ProductList] ========== 상품 수정 API 호출 ==========')
      console.log('[ProductList] productId:', productId)
      console.log('[ProductList] field:', field)
      console.log('[ProductList] editingValue:', editingValue)
      console.log('[ProductList] updateData:', JSON.stringify(updateData, null, 2))
      console.log('[ProductList] API URL:', `/api/v1/admin/products/${productId}`)

      // updateProduct API 호출
      apiService.updateProduct(productId, updateData).then((response) => {
        console.log('[ProductList] ========== 상품 수정 성공 ==========')
        console.log('[ProductList] 응답 데이터:', JSON.stringify(response, null, 2))
        message.success('상품 정보가 수정되었습니다.')
        setEditingCell(null)
        setEditingValue('')
        queryClient.invalidateQueries({ queryKey: ['products'] })
        refetch()
      }).catch((error: any) => {
        console.error('[ProductList] ========== 상품 수정 실패 ==========')
        console.error('[ProductList] 에러 상태:', error.response?.status)
        console.error('[ProductList] 에러 데이터:', JSON.stringify(error.response?.data, null, 2))
        console.error('[ProductList] 에러 메시지:', error.message)
        message.error(error.response?.data?.message || '상품 수정에 실패했습니다.')
      })
      return
    }

    // 재고/안전재고 수정 로직 (별도 API 사용)
    if (field === 'stockQty' || field === 'safetyStock') {
      if (isNaN(numValue) || numValue < 0) {
        message.error(`올바른 ${field === 'stockQty' ? '재고 수량' : '안전재고'}을 입력해주세요.`)
        return
      }

      const updateData: StockUpdateRequest = {
        stockQty: field === 'stockQty' ? numValue : product.stockQty,
        safetyStock: field === 'safetyStock' ? numValue : product.safetyStock,
        memo: `${field === 'stockQty' ? '재고' : '안전재고'} 수정 (인라인 편집)`,
      }

      apiService.updateProductStock(productId, updateData).then(() => {
        message.success(`${field === 'stockQty' ? '재고' : '안전재고'}가 수정되었습니다.`)
        setEditingCell(null)
        setEditingValue('')
        queryClient.invalidateQueries({ queryKey: ['products'] })
        refetch()
      }).catch((error: any) => {
        message.error(error.response?.data?.message || '재고 수정에 실패했습니다.')
      })
      return
    }
  }

  // 셀 편집 취소
  const handleCellCancel = () => {
    setEditingCell(null)
    setEditingValue('')
  }

  // 특정 상품 주문 생성 핸들러 (현재 사용하지 않음)
  // const handleCreateOrderForProduct = (product: AdminProductStockRow) => {
  //   setSelectedProductForOrder(product)
  //   orderForm.setFieldsValue({
  //     quantity: 1,
  //     paymentMethod: 'BANK_TRANSFER',
  //   })
  //   setIsOrderModalOpen(true)
  // }

  // 편집 가능한 셀 렌더러
  const renderEditableCell = (
    productId: number,
    field: string,
    value: number | string | boolean | undefined,
    isEditing: boolean,
    onSave: () => void,
    onCancel: () => void,
    customRenderer?: (value: number | string | boolean | undefined) => React.ReactNode
  ) => {
    if (isEditing) {
      if (field === 'active') {
        return (
          <Space>
            <Switch
              checked={editingValue === 'true'}
              onChange={(checked) => setEditingValue(String(checked))}
              size="small"
            />
            <Button size="small" type="primary" onClick={onSave}>저장</Button>
            <Button size="small" onClick={onCancel}>취소</Button>
          </Space>
        )
      }
      if (field === 'category') {
        // 서버에서 가져온 카테고리 목록 사용
        const serverCategories = serverCategoriesData?.data || []
        return (
          <Space>
            <Select
              value={editingValue}
              onChange={(val) => setEditingValue(val)}
              autoFocus
              size="small"
              style={{ width: 140 }}
            >
              {serverCategories.filter(cat => cat.active !== false).map(cat => (
                <Select.Option key={cat.categoryId} value={cat.categoryId}>
                  {cat.name}
                </Select.Option>
              ))}
            </Select>
            <Button size="small" type="primary" onClick={onSave}>저장</Button>
            <Button size="small" onClick={onCancel}>취소</Button>
          </Space>
        )
      }
      if (field === 'taxType') {
        return (
          <Space>
            <Select
              value={editingValue}
              onChange={(val) => setEditingValue(val)}
              autoFocus
              size="small"
              style={{ width: 100 }}
            >
              <Select.Option value="TAXABLE">과세</Select.Option>
              <Select.Option value="TAX_EXEMPT">면세</Select.Option>
            </Select>
            <Button size="small" type="primary" onClick={onSave}>저장</Button>
            <Button size="small" onClick={onCancel}>취소</Button>
          </Space>
        )
      }
      return (
        <Space>
          <InputNumber
            value={Number(editingValue)}
            onChange={(val) => setEditingValue(String(val ?? 0))}
            onPressEnter={onSave}
            autoFocus
            size="small"
            style={{ width: 120 }}
            min={0}
            formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            parser={(value) => Number(value!.replace(/\$\s?|(,*)/g, ''))}
          />
          <Button size="small" type="primary" onClick={onSave}>저장</Button>
          <Button size="small" onClick={onCancel}>취소</Button>
        </Space>
      )
    }
    return (
      <span
        onClick={() => handleCellDoubleClick(productId, field, value ?? 0)}
        onDoubleClick={() => handleCellDoubleClick(productId, field, value ?? 0)}
        style={{ cursor: 'pointer', padding: '4px 8px', display: 'inline-block', minWidth: 40, minHeight: 24 }}
        title="클릭하여 수정"
      >
        {customRenderer ? (
          customRenderer(value)
        ) : field === 'active' ? (
          <Switch checked={value === true} disabled size="small" />
        ) : field.includes('Price') || field === 'price' || field === 'purchasePrice' ? (
          formatCurrency(value as number)
        ) : (
          value ?? '-'
        )}
      </span>
    )
  }

  const getTaxTypeLabel = (taxType?: string) => {
    const taxTypeMap: Record<string, string> = {
      TAXABLE: '과세',
      TAX_EXEMPT: '면세',
    }
    return taxType ? taxTypeMap[taxType] || taxType : '-'
  }

  const getColumns = () => [
    {
      title: (
        <Checkbox
          checked={selectedProductIds.length === (filteredProducts?.length || 0) && selectedProductIds.length > 0}
          indeterminate={selectedProductIds.length > 0 && selectedProductIds.length < (filteredProducts?.length || 0)}
          onChange={(e: CheckboxChangeEvent) => {
            if (e.target.checked) {
              setSelectedProductIds(filteredProducts?.map(p => p.productId) || [])
            } else {
              setSelectedProductIds([])
            }
          }}
        />
      ),
      key: 'checkbox',
      width: 50,
      fixed: 'left' as const,
      render: (_: any, record: AdminProductStockRow) => (
        <Checkbox
          checked={selectedProductIds.includes(record.productId)}
          onChange={(e: CheckboxChangeEvent) => {
            if (e.target.checked) {
              setSelectedProductIds([...selectedProductIds, record.productId])
            } else {
              setSelectedProductIds(selectedProductIds.filter(id => id !== record.productId))
            }
          }}
        />
      ),
    },
    {
      title: '상품 ID',
      dataIndex: 'productId',
      key: 'productId',
      width: 100,
      fixed: 'left' as const,
    },
    {
      title: '상품명',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      fixed: 'left' as const,
    },
    {
      title: (
        <Space direction="vertical" size={0}>
          <span>카테고리</span>
          <span style={{ fontSize: 11, fontWeight: 'normal', color: '#999' }}>
            (더블클릭 수정)
          </span>
        </Space>
      ),
      dataIndex: 'categoryCode',
      key: 'category',
      width: 140,
      render: (_value: string | undefined, record: AdminProductStockRow) => {
        const isEditing = editingCell?.productId === record.productId && editingCell?.field === 'category'
        // 서버에서 받은 categoryName 또는 categoryCode 표시
        const displayValue = record.categoryName || record.categoryCode || '-'
        // categoryId를 우선 사용, 없으면 categoryCode로 서버 카테고리에서 찾기
        const serverCategories = serverCategoriesData?.data || []
        const currentCategoryId = record.categoryId || serverCategories.find(c => c.code === record.categoryCode)?.categoryId
        return renderEditableCell(
          record.productId,
          'category',
          currentCategoryId,
          isEditing,
          () => handleCellSave(record.productId, 'category'),
          handleCellCancel,
          () => (
            <Tag color="blue">
              {displayValue}
            </Tag>
          )
        )
      },
    },
    {
      title: (
        <Space direction="vertical" size={0}>
          <span>과세</span>
          <span style={{ fontSize: 11, fontWeight: 'normal', color: '#999' }}>
            (더블클릭 수정)
          </span>
        </Space>
      ),
      dataIndex: 'taxType',
      key: 'taxType',
      width: 120,
      render: (_value: string | undefined, record: AdminProductStockRow) => {
        const isEditing = editingCell?.productId === record.productId && editingCell?.field === 'taxType'
        return renderEditableCell(
          record.productId,
          'taxType',
          record.taxType,
          isEditing,
          () => handleCellSave(record.productId, 'taxType'),
          handleCellCancel,
          (value) => (
            <Tag color={value === 'TAX_EXEMPT' ? 'green' : 'orange'}>
              {getTaxTypeLabel(value as string)}
            </Tag>
          )
        )
      },
    },
    {
      title: (
        <Space direction="vertical" size={0}>
          <span>매입가</span>
          <span style={{ fontSize: 11, fontWeight: 'normal', color: '#999' }}>
            (더블클릭 수정)
          </span>
        </Space>
      ),
      dataIndex: 'purchasePrice',
      key: 'purchasePrice',
      width: 140,
      render: (_value: number | undefined, record: AdminProductStockRow) => {
        const isEditing = editingCell?.productId === record.productId && editingCell?.field === 'purchasePrice'
        return renderEditableCell(
          record.productId,
          'purchasePrice',
          record.purchasePrice ?? 0,
          isEditing,
          () => handleCellSave(record.productId, 'purchasePrice'),
          handleCellCancel
        )
      },
      align: 'right' as const,
    },
    {
      title: (
        <Space direction="vertical" size={0}>
          <span>판매가</span>
          <span style={{ fontSize: 11, fontWeight: 'normal', color: '#999' }}>
            (더블클릭 수정)
          </span>
        </Space>
      ),
      dataIndex: 'price',
      key: 'price',
      width: 140,
      render: (_value: number, record: AdminProductStockRow) => {
        const isEditing = editingCell?.productId === record.productId && editingCell?.field === 'price'
        return renderEditableCell(
          record.productId,
          'price',
          record.price,
          isEditing,
          () => handleCellSave(record.productId, 'price'),
          handleCellCancel
        )
      },
      align: 'right' as const,
    },
    {
      title: (
        <Space direction="vertical" size={0}>
          <span>무통장 할인</span>
          <span style={{ fontSize: 11, fontWeight: 'normal', color: '#999' }}>
            (더블클릭 수정)
          </span>
        </Space>
      ),
      key: 'bankTransferPrice',
      width: 120,
      render: (_: any, record: AdminProductStockRow) => {
        const bankTransferPrice = getBankTransferPrice(record) || record.price
        const discountAmount = record.price - bankTransferPrice
        const isEditing = editingCell?.productId === record.productId && editingCell?.field === 'bankTransferPrice'
        
        return renderEditableCell(
          record.productId,
          'bankTransferPrice',
          discountAmount, // 할인 금액을 값으로 전달
          isEditing,
          () => handleCellSave(record.productId, 'bankTransferPrice'),
          handleCellCancel,
          (value) => {
            const numValue = Number(value)
            if (numValue > 0) {
              return (
                <Typography.Text strong style={{ color: '#1890ff', fontSize: 14 }}>
                  {numValue.toLocaleString()}원
                </Typography.Text>
              )
            }
            return <Typography.Text type="secondary">-</Typography.Text>
          }
        )
      },
      align: 'right' as const,
    },
    {
      title: '수량할인',
      key: 'qtyDiscount',
      width: 150,
      render: (_: any, record: AdminProductStockRow) => {
        const qtyDiscount = getQtyDiscount(record)
        if (qtyDiscount) {
          const discountText = qtyDiscount.type === 'QTY_RATE' && qtyDiscount.discountRate
            ? `${qtyDiscount.minQty || '-'}개 / ${qtyDiscount.discountRate}%`
            : qtyDiscount.type === 'QTY_FIXED' && qtyDiscount.amountOff
            ? `${qtyDiscount.minQty || '-'}개 / ${formatCurrency(qtyDiscount.amountOff)}`
            : '-'
          
          return (
            <Tooltip title={qtyDiscount.label}>
              <Tag color="orange">{discountText}</Tag>
            </Tooltip>
          )
        }
        return <Typography.Text type="secondary">-</Typography.Text>
      },
    },
    {
      title: (
        <Space direction="vertical" size={0}>
          <span>픽업 할인</span>
          <span style={{ fontSize: 11, fontWeight: 'normal', color: '#999' }}>
            (더블클릭 수정)
          </span>
        </Space>
      ),
      key: 'pickupDiscountPrice',
      width: 120,
      render: (_: any, record: AdminProductStockRow) => {
        const pickupDiscount = getPickupDiscountPrice(record)
        const pickupPrice = pickupDiscount ? pickupDiscount.discountedPrice : record.price
        const discountAmount = record.price - pickupPrice
        const isEditing = editingCell?.productId === record.productId && editingCell?.field === 'pickupDiscountPrice'
        
        return renderEditableCell(
          record.productId,
          'pickupDiscountPrice',
          discountAmount, // 할인 금액을 값으로 전달
          isEditing,
          () => handleCellSave(record.productId, 'pickupDiscountPrice'),
          handleCellCancel,
          (value) => {
            const numValue = Number(value)
            if (numValue > 0) {
              return (
                <Typography.Text strong style={{ color: '#52c41a', fontSize: 14 }}>
                  {numValue.toLocaleString()}원
                </Typography.Text>
              )
            }
            return <Typography.Text type="secondary">-</Typography.Text>
          }
        )
      },
      align: 'right' as const,
    },
    {
      title: '재고',
      dataIndex: 'stockQty',
      key: 'stockQty',
      width: 100,
      render: (value: number, record: AdminProductStockRow) => {
        const isEditing = editingCell?.productId === record.productId && editingCell?.field === 'stockQty'
        
        if (isEditing) {
          return (
            <Input
              type="number"
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              onPressEnter={() => handleCellSave(record.productId, 'stockQty')}
              onBlur={() => handleCellSave(record.productId, 'stockQty')}
              autoFocus
              style={{ width: '100%' }}
            />
          )
        }
        
        return (
          <span
            onClick={() => handleCellDoubleClick(record.productId, 'stockQty', value)}
            style={{ cursor: 'pointer', textDecoration: 'underline' }}
          >
            {value}
          </span>
        )
      },
      align: 'right' as const,
    },
    {
      title: '전시상태',
      dataIndex: 'active',
      key: 'active',
      width: 100,
      render: (active: boolean) => (
        <Tag color={active !== false ? 'green' : 'red'}>
          {active !== false ? '전시중' : '숨김'}
        </Tag>
      ),
      align: 'center' as const,
    },
    {
      title: '안전재고',
      dataIndex: 'safetyStock',
      key: 'safetyStock',
      width: 100,
      render: (value: number, record: AdminProductStockRow) => {
        const isEditing = editingCell?.productId === record.productId && editingCell?.field === 'safetyStock'
        return renderEditableCell(
          record.productId,
          'safetyStock',
          value,
          isEditing,
          () => handleCellSave(record.productId, 'safetyStock'),
          handleCellCancel
        )
      },
      align: 'right' as const,
    },
    {
      title: '전시',
      dataIndex: 'active',
      key: 'display',
      width: 100,
      render: (_value: boolean | undefined, record: AdminProductStockRow) => {
        const isActive = record.active !== false
        return (
          <Switch
            checked={isActive}
            onChange={() => {
              handleToggleProductDisplay(record.productId, record.name, isActive)
            }}
            checkedChildren="ON"
            unCheckedChildren="OFF"
            loading={toggleProductDisplayMutation.isPending}
          />
        )
      },
      align: 'center' as const,
    },
    {
      title: '작업',
      key: 'actions',
      width: 150,
      render: (_: any, record: AdminProductStockRow) => (
        <Space>
          <Button
            type="link"
            size="small"
            onClick={() => handleEditProduct(record)}
          >
            수정
          </Button>
          <Button
            type="link"
            danger
            size="small"
            onClick={() => handleDeleteProduct(record.productId, record.name)}
          >
            삭제
          </Button>
        </Space>
      ),
    },
  ]

  const products = productsData?.data || []

  // 삭제된 상품만 제외 (숨김 상품은 포함)
  const activeProducts = useMemo(() => {
    return products.filter(p => !p.deletedAt)
  }, [products])

  // 카테고리별 상품 필터링 + 전시순서(sortOrder) 정렬 (테이블·모달 공통)
  const filteredProducts = useMemo(() => {
    const list = selectedCategoryFilter === 'ALL'
      ? activeProducts
      : activeProducts.filter(p => p.categoryCode === selectedCategoryFilter)
    return [...list].sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999))
  }, [activeProducts, selectedCategoryFilter])

  // 카테고리별 통계 (서버 카테고리 기반, 활성 상품만)
  const serverCategoryStats = useMemo(() => {
    const stats: Record<string, { count: number; totalStock: number }> = {}
    const serverCategories = serverCategoriesData?.data || []
    
    serverCategories.forEach(cat => {
      stats[cat.code] = { count: 0, totalStock: 0 }
    })

    activeProducts.forEach(product => {
      const categoryCode = product.categoryCode || 'OTHER'
      if (stats[categoryCode]) {
        stats[categoryCode].count++
        stats[categoryCode].totalStock += product.stockQty
      } else {
        // 알 수 없는 카테고리
        if (!stats['OTHER']) {
          stats['OTHER'] = { count: 0, totalStock: 0 }
        }
        stats['OTHER'].count++
        stats['OTHER'].totalStock += product.stockQty
      }
    })

    return stats
  }, [activeProducts, categories])

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Title level={2} style={{ margin: 0 }}>판매 상품 관리</Title>
        <Space wrap>
          <Button 
            icon={<ReloadOutlined spin={isRefreshing} />} 
            onClick={async () => {
              setIsRefreshing(true)
              // 모든 관련 쿼리 무효화 후 강제로 다시 불러오기
              await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['products'] }),
                queryClient.invalidateQueries({ queryKey: ['discountPolicies'] }),
              ])
              await Promise.all([
                refetch(),
                refetchDiscountPolicies(),
              ])
              setTimeout(() => {
                setIsRefreshing(false)
                message.success({ content: '✅ 새로고침 완료!', duration: 1.5 })
              }, 300)
            }} 
            loading={isRefreshing}
            type="primary"
            style={{ 
              minWidth: 110,
              transition: 'all 0.3s',
              ...(isRefreshing ? { backgroundColor: '#52c41a', borderColor: '#52c41a' } : {})
            }}
          >
            {isRefreshing ? '새로고침 중...' : '새로고침'}
          </Button>
          <Button 
            icon={<GiftOutlined />} 
            onClick={() => setIsCategoryManagementOpen(true)}
          >
            카테고리 관리
          </Button>
          <Button 
            icon={<OrderedListOutlined />} 
            onClick={handleOpenReorderModal}
          >
            전시 순서 변경
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddProduct}>
            상품 등록
          </Button>
        </Space>
      </div>

      {/* 카테고리 관리 모달 */}
      <Modal
        title="카테고리 관리"
        open={isCategoryManagementOpen}
        onCancel={() => {
          setIsCategoryManagementOpen(false)
          setEditingServerCategory(null)
          categoryEditForm.resetFields()
        }}
        footer={[
          <Button key="close" type="primary" onClick={() => {
            setIsCategoryManagementOpen(false)
            setEditingServerCategory(null)
            categoryEditForm.resetFields()
          }}>
            닫기
          </Button>
        ]}
        width={900}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Typography.Title level={5}>카테고리별 상품 현황</Typography.Title>
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
              카테고리를 클릭하여 수정하거나 삭제할 수 있습니다.
            </Typography.Text>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
              {(serverCategoriesData?.data || []).filter(cat => cat.active).map(category => {
                const stats = serverCategoryStats[category.code] || { count: 0, totalStock: 0 }
                return (
                  <Card 
                    key={category.categoryId}
                    size="small"
                    hoverable
                    style={{ border: editingServerCategory?.categoryId === category.categoryId ? '2px solid #1890ff' : undefined }}
                  >
                    <Space direction="vertical" size={8} style={{ width: '100%' }}>
                      <div onClick={() => {
                        setSelectedCategoryFilter(category.code)
                        setIsCategoryManagementOpen(false)
                      }} style={{ cursor: 'pointer' }}>
                        <Tag color="blue">{category.name}</Tag>
                        <Typography.Text strong style={{ fontSize: 20, display: 'block', marginTop: 4 }}>
                          {stats.count}개
                        </Typography.Text>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          총 재고: {stats.totalStock}개
                        </Typography.Text>
                        <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                          {category.code} 상품
                        </Typography.Text>
                      </div>
                      <Space size="small" style={{ width: '100%', justifyContent: 'flex-end' }}>
                        <Button
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingServerCategory(category)
                            categoryEditForm.setFieldsValue({
                              name: category.name,
                            })
                          }}
                        >
                          수정
                        </Button>
                        <Button
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={(e) => {
                            e.stopPropagation()
                            Modal.confirm({
                              title: '카테고리 삭제',
                              content: `"${category.name}" 카테고리를 삭제하시겠습니까?`,
                              okText: '삭제',
                              okButtonProps: { danger: true },
                              onOk: async () => {
                                try {
                                  await apiService.deleteCategory(category.categoryId)
                                  message.success(`"${category.name}" 카테고리가 삭제되었습니다.`)
                                  queryClient.invalidateQueries({ queryKey: ['adminCategories'] })
                                } catch (error) {
                                  console.error('카테고리 삭제 에러:', error)
                                  message.error('카테고리 삭제에 실패했습니다.')
                                }
                              }
                            })
                          }}
                        >
                          삭제
                        </Button>
                      </Space>
                    </Space>
                  </Card>
                )
              })}
            </div>
          </div>

          {editingServerCategory && (
            <Card 
              title={`"${editingServerCategory.name}" 수정`} 
              size="small"
              extra={
                <Button 
                  size="small" 
                  onClick={() => {
                    setEditingServerCategory(null)
                    categoryEditForm.resetFields()
                  }}
                >
                  취소
                </Button>
              }
            >
              <Form
                form={categoryEditForm}
                layout="vertical"
                onFinish={async (values) => {
                  try {
                    await apiService.updateCategory(editingServerCategory.categoryId, {
                      name: values.name
                    })
                    message.success('카테고리가 수정되었습니다.')
                    setEditingServerCategory(null)
                    categoryEditForm.resetFields()
                    queryClient.invalidateQueries({ queryKey: ['adminCategories'] })
                  } catch (error) {
                    console.error('카테고리 수정 에러:', error)
                    message.error('카테고리 수정에 실패했습니다.')
                  }
                }}
              >
                <Form.Item
                  label="이름"
                  name="name"
                  rules={[{ required: true, message: '이름을 입력해주세요.' }]}
                >
                  <Input placeholder="카테고리 이름" />
                </Form.Item>
                <Button type="primary" htmlType="submit" block>
                  저장
                </Button>
              </Form>
            </Card>
          )}
        </Space>
      </Modal>

      {/* 카테고리 필터 현황 */}
      {selectedCategoryFilter !== 'ALL' && (
        <Card style={{ marginBottom: 24, backgroundColor: '#f0f5ff', border: '1px solid #adc6ff' }}>
          <Space align="center">
            <Typography.Text strong>현재 필터:</Typography.Text>
            <Tag 
              color="blue"
              style={{ fontSize: 14, padding: '4px 12px' }}
            >
              {(serverCategoriesData?.data || []).find(c => c.code === selectedCategoryFilter)?.name || selectedCategoryFilter}
            </Tag>
            <Typography.Text>
              {filteredProducts.length}개 상품 표시 중
            </Typography.Text>
            <Button 
              type="link" 
              size="small" 
              onClick={() => setSelectedCategoryFilter('ALL')}
            >
              필터 해제
            </Button>
          </Space>
        </Card>
      )}

      {/* 할인 정책 관리 섹션 */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={4} style={{ margin: 0 }}>할인 정책 관리</Title>
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={() => setIsDiscountPolicyModalOpen(true)}
          >
            할인 정책 추가
          </Button>
        </div>
        
        {discountPoliciesData?.data && discountPoliciesData.data.length > 0 ? (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              할인룰을 추가할 정책을 선택하세요. 선택된 정책에 할인룰이 추가됩니다.
            </Typography.Text>
            <Collapse
              items={discountPoliciesData.data.map((policy: DiscountPolicyResponse) => ({
                key: policy.id,
                label: (
                  <Space>
                    <input
                      type="checkbox"
                      checked={checkedPolicyIds.includes(policy.id)}
                      onChange={(e) => {
                        e.stopPropagation()
                        if (e.target.checked) {
                          setCheckedPolicyIds([...checkedPolicyIds, policy.id])
                        } else {
                          setCheckedPolicyIds(checkedPolicyIds.filter(id => id !== policy.id))
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span>{policy.name}</span>
                    <Tag color={policy.active ? 'green' : 'red'}>
                      {policy.active ? '활성' : '비활성'}
                    </Tag>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      ({policy.rules?.length || 0}개 룰)
                    </Typography.Text>
                    <Button
                      type="link"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteDiscountPolicy(policy.id)
                      }}
                      loading={deleteDiscountPolicyMutation.isPending}
                    >
                      삭제
                    </Button>
                  </Space>
                ),
                children: (
                  <>
                    <div style={{ marginBottom: 12 }}>
                      <Button
                        type="primary"
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={() => {
                          setSelectedDiscountPolicyId(policy.id)
                          discountRuleForm.setFieldsValue({ policyId: policy.id })
                          setIsDiscountRuleModalOpen(true)
                        }}
                      >
                        할인 룰 추가
                      </Button>
                    </div>
                    {policy.rules && policy.rules.length > 0 ? (
                      <Table
                        columns={[
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
                            title: '최소수량',
                            dataIndex: 'minQty',
                            key: 'minQty',
                            render: (qty: number) => qty !== undefined ? qty : '-',
                          },
                          {
                            title: '상태',
                            dataIndex: 'active',
                            key: 'active',
                            render: (active: boolean) => (
                              <Tag color={active ? 'green' : 'red'}>{active ? '활성' : '비활성'}</Tag>
                            ),
                          },
                          {
                            title: '작업',
                            key: 'actions',
                            width: 100,
                            render: (_: any, record: DiscountRuleResponse) => (
                              <Button
                                type="link"
                                danger
                                size="small"
                                icon={<DeleteOutlined />}
                                onClick={() => handleDeleteDiscountRule(record.id)}
                                loading={deleteDiscountRuleMutation.isPending}
                              >
                                삭제
                              </Button>
                            ),
                          },
                        ]}
                        dataSource={policy.rules}
                        rowKey="id"
                        pagination={false}
                        size="small"
                      />
                    ) : (
                      <Typography.Text type="secondary">등록된 할인 룰이 없습니다.</Typography.Text>
                    )}
                  </>
                ),
              }))}
            />
          </Space>
        ) : (
          <Typography.Text type="secondary">등록된 할인 정책이 없습니다. "할인 정책 추가" 버튼을 클릭하여 추가하세요.</Typography.Text>
        )}
      </Card>

      {error && (
        <Card 
          style={{ 
            marginBottom: 24, 
            borderColor: '#ff4d4f',
            backgroundColor: '#fff1f0'
          }}
        >
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Space>
              <ExclamationCircleOutlined style={{ fontSize: 24, color: '#ff4d4f' }} />
              <Typography.Title level={4} style={{ margin: 0, color: '#ff4d4f' }}>
                상품 목록을 불러오는데 실패했습니다
              </Typography.Title>
            </Space>
            <Typography.Paragraph style={{ margin: 0 }}>
              서버에서 500 Internal Server Error를 반환했습니다.
            </Typography.Paragraph>
            
            <Card size="small" title="🔧 서버 관리자 조치 사항" style={{ backgroundColor: '#fffbe6' }}>
              <Typography.Paragraph style={{ margin: 0, marginBottom: 8 }}>
                <Typography.Text strong>1. 데이터베이스 스키마 확인</Typography.Text>
              </Typography.Paragraph>
              <pre style={{ 
                backgroundColor: '#f5f5f5', 
                padding: 8, 
                borderRadius: 4, 
                fontSize: 11,
                overflow: 'auto'
              }}>
{`-- category, taxType 컬럼 추가
ALTER TABLE products 
  ADD COLUMN category VARCHAR(50),
  ADD COLUMN tax_type VARCHAR(50);

-- 기존 데이터 기본값 설정
UPDATE products 
SET category = 'OTHER', 
    tax_type = 'TAXABLE' 
WHERE category IS NULL OR tax_type IS NULL;`}
              </pre>
              
              <Typography.Paragraph style={{ margin: 0, marginTop: 12, marginBottom: 8 }}>
                <Typography.Text strong>2. 또는 서버 코드 수정</Typography.Text>
              </Typography.Paragraph>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                AdminProductStockRow 응답에서 category, taxType을 nullable로 처리하도록 수정
              </Typography.Text>
            </Card>

            <Typography.Paragraph style={{ margin: 0, fontSize: 12 }}>
              <Typography.Text type="secondary">
                💡 프론트엔드는 이미 하위 호환성을 지원합니다. 상품 생성 시 category와 taxType은 선택사항으로 처리됩니다.
              </Typography.Text>
            </Typography.Paragraph>

            {error instanceof Error && (
              <Typography.Text type="secondary" style={{ fontSize: 12, fontFamily: 'monospace' }}>
                에러 상세: {error.message}
              </Typography.Text>
            )}
            
            <Button 
              type="primary" 
              onClick={() => refetch()}
              icon={<ReloadOutlined />}
            >
              다시 시도
            </Button>
          </Space>
        </Card>
      )}
      <Card>
        {selectedProductIds.length > 0 && (
          <div style={{ marginBottom: 16, padding: '12px 16px', backgroundColor: '#f0f5ff', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography.Text strong>
              {selectedProductIds.length}개 상품 선택됨
            </Typography.Text>
            <Space>
              <Button
                type="primary"
                onClick={() => {
                  Modal.confirm({
                    title: '상품 활성화',
                    content: `선택한 ${selectedProductIds.length}개 상품을 활성화하시겠습니까?`,
                    okText: '활성화',
                    cancelText: '취소',
                    onOk: () => {
                      bulkUpdateActiveStateMutation.mutate({ productIds: selectedProductIds, active: true })
                    },
                  })
                }}
              >
                활성화
              </Button>
              <Button
                danger
                onClick={() => {
                  Modal.confirm({
                    title: '상품 비활성화',
                    content: `선택한 ${selectedProductIds.length}개 상품을 비활성화하시겠습니까?`,
                    okText: '비활성화',
                    okButtonProps: { danger: true },
                    cancelText: '취소',
                    onOk: () => {
                      bulkUpdateActiveStateMutation.mutate({ productIds: selectedProductIds, active: false })
                    },
                  })
                }}
              >
                비활성화
              </Button>
              <Button
                onClick={() => setSelectedProductIds([])}
              >
                선택 해제
              </Button>
            </Space>
          </div>
        )}
        <div style={{ overflowX: 'auto' }}>
          <Table
            columns={getColumns()}
            dataSource={filteredProducts}
            rowKey="productId"
            loading={isLoading}
            pagination={{ pageSize: 20 }}
            scroll={{ x: 'max-content' }}
            locale={{
              emptyText: isLoading 
                ? '상품 데이터를 불러오는 중...' 
                : '등록된 상품이 없습니다. 상품을 등록해주세요.',
            }}
          />
        </div>
      </Card>

      <Modal
        title="상품 등록"
        open={isModalOpen}
        onOk={handleModalOk}
        onCancel={() => {
          setIsModalOpen(false)
          form.resetFields()
        }}
        confirmLoading={createProductMutation.isPending}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="상품명"
            name="name"
            rules={[{ required: true, message: '상품명을 입력해주세요.' }]}
          >
            <Input placeholder="예: 초코찰떡롤" />
          </Form.Item>
          <Form.Item
            label="카테고리"
            name="categoryId"
            extra={serverCategories.length === 0 ? "서버에 등록된 카테고리가 없습니다" : "선택사항"}
          >
            <Select placeholder="카테고리 선택 (선택사항)" allowClear>
              {serverCategories.filter((cat: AdminCategoryRow) => cat.active).map((cat: AdminCategoryRow) => (
                <Select.Option key={cat.categoryId} value={cat.categoryId}>
                  {cat.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label="과세 유형"
            name="taxType"
            extra="선택사항 (서버가 지원하지 않으면 무시됨)"
          >
            <Select placeholder="과세 유형 선택 (선택사항)" allowClear>
              <Select.Option value="TAXABLE">과세</Select.Option>
              <Select.Option value="TAX_EXEMPT">면세</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            label="매입가"
            name="purchasePrice"
            rules={[
              { type: 'number', min: 0, message: '0 이상의 값을 입력해주세요.' },
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="18000"
              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => value!.replace(/\$\s?|(,*)/g, '')}
            />
          </Form.Item>
          <Form.Item
            label="판매가"
            name="price"
            rules={[
              { required: true, message: '판매가를 입력해주세요.' },
              { type: 'number', min: 0, message: '0 이상의 값을 입력해주세요.' },
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="26000"
              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => value!.replace(/\$\s?|(,*)/g, '')}
            />
          </Form.Item>
          <Form.Item
            label="초기 재고"
            name="initialStockQty"
            rules={[
              { required: true, message: '초기 재고를 입력해주세요.' },
              { type: 'number', min: 0, message: '0 이상의 값을 입력해주세요.' },
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="100"
              min={0}
            />
          </Form.Item>
          <Form.Item
            label="안전 재고"
            name="safetyStock"
            rules={[
              { required: true, message: '안전 재고를 입력해주세요.' },
              { type: 'number', min: 0, message: '0 이상의 값을 입력해주세요.' },
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="10"
              min={0}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="재고 수정"
        open={isStockModalOpen}
        onOk={handleStockModalOk}
        onCancel={() => {
          setIsStockModalOpen(false)
          setEditingProduct(null)
          stockForm.resetFields()
        }}
        confirmLoading={updateStockMutation.isPending}
        width={600}
      >
        <Form form={stockForm} layout="vertical">
          <Form.Item
            label="재고 수량"
            name="stockQty"
            rules={[
              { required: true, message: '재고 수량을 입력해주세요.' },
              { type: 'number', min: 0, message: '0 이상의 값을 입력해주세요.' },
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="재고 수량"
              min={0}
            />
          </Form.Item>
          <Form.Item
            label="안전 재고"
            name="safetyStock"
            rules={[
              { required: true, message: '안전 재고를 입력해주세요.' },
              { type: 'number', min: 0, message: '0 이상의 값을 입력해주세요.' },
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="안전 재고"
              min={0}
            />
          </Form.Item>
          <Form.Item label="메모" name="memo">
            <Input.TextArea rows={2} placeholder="재고 수정 사유 (선택사항)" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 특정 상품 주문 생성 모달 */}
      <Modal
        title={`주문 생성 - ${selectedProductForOrder?.name}`}
        open={isOrderModalOpen}
        onOk={() => {
          orderForm.validateFields().then(() => {
            message.info('주문 생성 기능은 고객 프로필 페이지에서 제공됩니다.')
            setIsOrderModalOpen(false)
            orderForm.resetFields()
            setSelectedProductForOrder(null)
          })
        }}
        onCancel={() => {
          setIsOrderModalOpen(false)
          orderForm.resetFields()
          setSelectedProductForOrder(null)
        }}
        width={600}
      >
        <Form form={orderForm} layout="vertical">
          <Form.Item
            label="수량"
            name="quantity"
            rules={[
              { required: true, message: '수량을 입력해주세요.' },
              { type: 'number', min: 1, message: '1 이상의 값을 입력해주세요.' },
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="수량"
              min={1}
            />
          </Form.Item>
          <Form.Item
            label="결제 수단"
            name="paymentMethod"
            rules={[{ required: true, message: '결제 수단을 선택해주세요.' }]}
          >
            <Select>
              <Select.Option value="BANK_TRANSFER">무통장 입금</Select.Option>
              <Select.Option value="CARD">카드</Select.Option>
            </Select>
          </Form.Item>
          <Typography.Text type="secondary">
            주문 생성은 고객 프로필 페이지에서 고객을 선택한 후 진행할 수 있습니다.
          </Typography.Text>
        </Form>
      </Modal>

      {/* 상품 수정 모달 */}
      <Modal
        title={`상품 수정 - ${editingProduct?.name || ''}`}
        open={isEditProductModalOpen}
        onOk={handleEditProductSubmit}
        onCancel={() => {
          setIsEditProductModalOpen(false)
          setEditingProduct(null)
          editProductForm.resetFields()
        }}
        confirmLoading={editProductMutation.isPending}
        width={600}
        okText="수정"
        cancelText="취소"
      >
        <Form form={editProductForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            label="상품명"
            name="name"
            rules={[{ required: true, message: '상품명을 입력해주세요.' }]}
          >
            <Input placeholder="상품명 입력" />
          </Form.Item>
          <Form.Item
            label="판매가"
            name="price"
            rules={[
              { required: true, message: '판매가를 입력해주세요.' },
              { type: 'number', min: 0, message: '0 이상의 값을 입력해주세요.' },
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="판매가 입력"
              min={0}
              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => value?.replace(/\$\s?|(,*)/g, '') as any}
            />
          </Form.Item>
          <Form.Item
            label="매입가"
            name="purchasePrice"
            rules={[
              { type: 'number', min: 0, message: '0 이상의 값을 입력해주세요.' },
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="매입가 입력 (선택)"
              min={0}
              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => value?.replace(/\$\s?|(,*)/g, '') as any}
            />
          </Form.Item>
          <Form.Item
            label="카테고리"
            name="categoryId"
          >
            <Select placeholder="카테고리 선택 (선택)" allowClear>
              {serverCategories.filter((cat: AdminCategoryRow) => cat.active).map((cat: AdminCategoryRow) => (
                <Select.Option key={cat.categoryId} value={cat.categoryId}>
                  {cat.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label="과세 유형"
            name="taxType"
          >
            <Select placeholder="과세 유형 선택 (선택)">
              <Select.Option value="TAXABLE">과세</Select.Option>
              <Select.Option value="TAX_EXEMPT">면세</Select.Option>
            </Select>
          </Form.Item>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            * 재고 및 안전재고는 테이블에서 직접 더블클릭하여 수정할 수 있습니다.
          </Typography.Text>
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
        title={
          _addingRuleProductId 
            ? `할인 룰 생성 - ${products.find(p => p.productId === _addingRuleProductId)?.name || `상품 ID: ${_addingRuleProductId}`}`
            : "할인 룰 생성"
        }
        open={isDiscountRuleModalOpen}
        onOk={handleDiscountRuleSubmit}
        onCancel={() => {
          setIsDiscountRuleModalOpen(false)
          setSelectedDiscountPolicyId(null)
          setAddingRuleProductId(null)
          discountRuleForm.resetFields()
        }}
        confirmLoading={createDiscountRuleMutation.isPending}
        width={600}
      >
        <Form form={discountRuleForm} layout="vertical">
          <Form.Item
            label="정책"
            name="policyId"
            rules={selectedDiscountPolicyId === null && checkedPolicyIds.length !== 1 ? [{ required: true, message: '정책을 선택해주세요.' }] : []}
            extra={
              selectedDiscountPolicyId 
                ? `선택된 정책: ${discountPoliciesData?.data?.find(p => p.id === selectedDiscountPolicyId)?.name || selectedDiscountPolicyId}`
                : checkedPolicyIds.length === 1
                ? `체크된 정책: ${discountPoliciesData?.data?.find(p => p.id === checkedPolicyIds[0])?.name || checkedPolicyIds[0]}`
                : checkedPolicyIds.length > 1
                ? `여러 정책이 체크되어 있습니다. 아래에서 선택하거나 하나만 체크하세요.`
                : '상단에서 할인 정책을 체크하거나 아래에서 선택하세요.'
            }
          >
            <Select 
              placeholder="정책 선택" 
              disabled={selectedDiscountPolicyId !== null || checkedPolicyIds.length === 1}
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
            label="이름"
            name="label"
            rules={[{ required: true, message: '이름을 입력해주세요.' }]}
          >
            <Input placeholder="예: 무통장 할인" />
          </Form.Item>
          <Form.Item
            label="상품"
            name="targetProductId"
            rules={[
              { required: true, message: '상품을 선택해주세요.' },
              { type: 'number', min: 1, message: '1 이상의 값을 입력해주세요.' },
            ]}
            extra={
              _addingRuleProductId 
                ? `선택된 상품: ${products.find(p => p.productId === _addingRuleProductId)?.name || '알 수 없음'}`
                : '상품 ID를 직접 입력하거나 상품 목록에서 "할인룰" 버튼을 클릭하세요.'
            }
          >
            <InputNumber 
              style={{ width: '100%' }} 
              placeholder="상품 ID" 
              min={1}
              disabled={!!_addingRuleProductId}
            />
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

      {/* 상품·카테고리 전시 순서 변경 모달 (카테고리 안에 상품, 전시 ON 상품만) */}
      <Modal
        title="전시 순서 변경"
        open={isReorderModalOpen}
        onOk={handleSaveReorder}
        onCancel={() => {
          setIsReorderModalOpen(false)
          setReorderData([])
        }}
        confirmLoading={isSavingReorder}
        width={700}
        okText="저장"
        cancelText="취소"
      >
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Space direction="vertical" size={4}>
            <Typography.Text type="secondary">
              <HolderOutlined style={{ marginRight: 8 }} />
              카테고리 헤더를 드래그하면 해당 카테고리와 상품이 함께 이동합니다. 상품은 카테고리 내에서만 순서를 변경할 수 있습니다. (전시 ON 상품만 표시)
            </Typography.Text>
          </Space>
          <Button
            size="small"
            icon={<ReloadOutlined />}
            onClick={async () => {
              const { data: freshData } = await refetch()
              const products = freshData?.data || []
              const data = buildReorderDataFromProducts(products)
              setReorderData(data)
              reorderDataRef.current = data
              message.success('목록을 새로고침했습니다.')
            }}
          >
            새로고침
          </Button>
        </div>
        <div style={{ maxHeight: 520, overflowY: 'auto', padding: '4px' }}>
          {reorderData.length > 0 ? (
            <DndContext
              sensors={sensors}
              collisionDetection={pointerWithin}
              onDragEnd={handleCategoryDragEnd}
            >
              <SortableContext
                items={reorderData.map(d => getCategorySortableId(d))}
                strategy={verticalListSortingStrategy}
              >
                {reorderData.map((cwp, index) => (
                  <SortableCategoryBlock
                    key={cwp.category.categoryId}
                    categoryWithProducts={cwp}
                    categoryIndex={index}
                    categories={categories}
                    onProductDragEnd={handleProductDragEnd}
                  />
                ))}
              </SortableContext>
            </DndContext>
          ) : (
            <Typography.Text type="secondary">표시할 카테고리/상품이 없습니다.</Typography.Text>
          )}
        </div>
      </Modal>
    </div>
  )
}

export default ProductList
