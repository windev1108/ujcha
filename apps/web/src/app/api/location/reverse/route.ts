import { env } from '@/config/env';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');

  if (!lat || !lon) {
    return NextResponse.json(
      {
        message: 'lat and lon are required',
      },
      { status: 400 },
    );
  }

  const apiUrl = env.API_URL

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
      '/locations/reverse',
      apiUrl,
    );

    backendUrl.searchParams.set('lat', lat);
    backendUrl.searchParams.set('lon', lon);

    const response = await fetch(backendUrl.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error) {
    console.error('Location proxy failed:', error);

    return NextResponse.json(
      {
        message: 'Unable to resolve location',
      },
      { status: 503 },
    );
  }
}