import { NextRequest, NextResponse } from 'next/server';
import { productService } from '@/lib/products';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const limitParam = searchParams.get('limit');
  const offsetParam = searchParams.get('offset');
  const limit = limitParam ? (parseInt(limitParam, 10) || 20) : 20;
  const offset = offsetParam ? (parseInt(offsetParam, 10) || 0) : 0;

  const filters = {
    category: searchParams.get('category') || undefined,
    subCategory: searchParams.get('subCategory') || undefined,
    search: searchParams.get('search') || undefined,
    limit: Math.min(Math.max(1, limit), 100),
    offset: Math.max(0, offset),
  };

  const products = productService.getAll(filters);
  const total = productService.getTotalCount({
    category: filters.category,
    subCategory: filters.subCategory,
    search: filters.search,
  });

  return NextResponse.json({
    products,
    total,
    limit: filters.limit,
    offset: filters.offset,
  });
}
