import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getTryOnProvider } from '@/src/server/tryon/providers'
import { FashnProvider } from '@/src/server/tryon/providers/fashn'

export async function GET(request: NextRequest) {
  try {
    await requireAuth()
    
    const provider = getTryOnProvider()
    
    // Check if the provider is FashnProvider
    if (!(provider instanceof FashnProvider)) {
      return NextResponse.json(
        { error: 'FASHN provider is not active' },
        { status: 400 }
      )
    }

    const credits = await provider.getAccountCredits()
    
    console.log('[API/fashn/credits] Provider returned:', credits)
    
    if (credits.error) {
      console.error('[API/fashn/credits] Error from provider:', credits.error)
      return NextResponse.json(
        { error: credits.error },
        { status: 500 }
      )
    }

    console.log('[API/fashn/credits] Returning credits:', credits)
    return NextResponse.json(credits)
  } catch (error: any) {
    console.error('Error fetching FASHN credits:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

