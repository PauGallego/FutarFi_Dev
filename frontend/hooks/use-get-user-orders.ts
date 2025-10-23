

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

if (!authData?.signature) {
      alert('Complete authentication first')
      return
    }
    
    setIsLoading(true)
    try {
      const response = await fetch(`${API_BASE}/orderbooks/my-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          signature: authData.signature,
          message: authData.message,
          timestamp: authData.timestamp
        })
      })
      
      const data = await response.json()
      setTestResults(prev => [{
        test: 'Get My Orders',
        status: response.ok ? 'SUCCESS' : 'FAILED',
        data,
        timestamp: new Date().toLocaleTimeString()
      }, ...prev])
    } catch (error) {
      setTestResults(prev => [{
        test: 'Get My Orders',
        status: 'ERROR',
        data: { error: error instanceof Error ? error.message : 'Unknown error' },
        timestamp: new Date().toLocaleTimeString()
      }, ...prev])
    }
    setIsLoading(false)