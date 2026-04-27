/**
 * Public API response envelope. Keep every `/api/v1/*` route returning this
 * exact shape so external consumers can build against a stable contract.
 *
 *   { success: true,  data: T }
 *   { success: false, error: string, code?: string }
 *
 * Pagination metadata is added under `meta` when relevant:
 *   { success: true, data: T[], meta: { total, page, limit } }
 */
import { NextResponse } from "next/server";

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: {
    total: number;
    page: number;
    limit: number;
  };
}

export interface ApiError {
  success: false;
  error: string;
  code?: string;
}

export function ok<T>(data: T, init?: { status?: number }): NextResponse {
  const body: ApiSuccess<T> = { success: true, data };
  return NextResponse.json(body, { status: init?.status ?? 200 });
}

export function okPaginated<T>(
  data: T[],
  meta: { total: number; page: number; limit: number },
): NextResponse {
  const body: ApiSuccess<T[]> = { success: true, data, meta };
  return NextResponse.json(body);
}

export function fail(
  status: number,
  error: string,
  code?: string,
): NextResponse {
  const body: ApiError = { success: false, error, ...(code ? { code } : {}) };
  return NextResponse.json(body, { status });
}
