import { env } from '@/config/env';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const q = searchParams.get('q');

  if (!q?.trim()) {
    return NextResponse.json(
      {
        message: 'q is required',
      },
      { status: 400 },
    );
  }

  const apiUrl = env.API_URL;

  if (!apiUrl) {
    console.error('API_URL is not configured');

    return NextResponse.json(
      {
        message: 'API_URL is not configured',
      },
      { status: 500 },
    );
  }

  try {
    const backendUrl = new URL(
      '/locations/search',
      apiUrl,
    );

    backendUrl.searchParams.set('q', q);

    const viewbox = searchParams.get('viewbox');
    const bounded = searchParams.get('bounded');
    const countrycodes =
      searchParams.get('countrycodes');
    const limit = searchParams.get('limit');
    const acceptLanguage =
      searchParams.get('accept-language');

    if (viewbox) {
      backendUrl.searchParams.set(
        'viewbox',
        viewbox,
      );
    }

    if (bounded) {
      backendUrl.searchParams.set(
        'bounded',
        bounded,
      );
    }

    if (countrycodes) {
      backendUrl.searchParams.set(
        'countrycodes',
        countrycodes,
      );
    }

    if (limit) {
      backendUrl.searchParams.set(
        'limit',
        limit,
      );
    }

    if (acceptLanguage) {
      backendUrl.searchParams.set(
        'accept-language',
        acceptLanguage,
      );
    }

    const response = await fetch(
      backendUrl.toString(),
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        cache: 'no-store',
      },
    );

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error) {
    console.error(
      'Location search proxy failed:',
      error,
    );

    return NextResponse.json(
      {
        message: 'Unable to search location',
      },
      { status: 503 },
    );
  }
}
