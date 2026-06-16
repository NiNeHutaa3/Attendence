export type AnomalyReason =
  | 'Developer Mode Active'
  | 'IP Address Outside Operational Area'
  | 'Developer Mode Active, IP Outside Operational Area'

export type IpRegionResult = {
  ipAddress: string
  region: string | null
  countryCode: string | null
}

export type AnomalyEvaluationInput = {
  developerModeActive: boolean
  ipRegion?: string | null
  countryCode?: string | null
}

export type AnomalyEvaluationResult = {
  anomaly_status: boolean
  anomaly_reason: AnomalyReason | null
}

const OPERATIONAL_REGION_KEYWORDS = [
  'kepulauan riau',
  'riau islands',
  'provinsi kepulauan riau',
]

const normalizeRegion = (value?: string | null) => value?.trim().toLowerCase() || ''

export const detectDeveloperModeActive = (): boolean => {
  if (typeof window === 'undefined') {
    return false
  }

  const explicitFlag = (window as any).__DEVELOPER_MODE_ACTIVE__
  if (typeof explicitFlag === 'boolean') {
    return explicitFlag
  }

  const localStorageFlag = window.localStorage.getItem('developerModeActive')
  if (localStorageFlag === 'true') {
    return true
  }

  return navigator.webdriver === true
}

export const isIpOutsideOperationalArea = (
  region?: string | null,
  countryCode?: string | null
) => {
  const normalizedRegion = normalizeRegion(region)
  const normalizedCountryCode = normalizeRegion(countryCode)

  if (!normalizedRegion) {
    return false
  }

  const isIndonesia = !normalizedCountryCode || normalizedCountryCode === 'id'
  const isKepri = OPERATIONAL_REGION_KEYWORDS.some((keyword) =>
    normalizedRegion.includes(keyword)
  )

  return !isIndonesia || !isKepri
}

export const evaluateAttendanceAnomaly = ({
  developerModeActive,
  ipRegion,
  countryCode,
}: AnomalyEvaluationInput): AnomalyEvaluationResult => {
  const developerModeAnomaly = developerModeActive === true
  const ipAnomaly = isIpOutsideOperationalArea(ipRegion, countryCode)

  if (developerModeAnomaly && ipAnomaly) {
    return {
      anomaly_status: true,
      anomaly_reason: 'Developer Mode Active, IP Outside Operational Area',
    }
  }

  if (developerModeAnomaly) {
    return {
      anomaly_status: true,
      anomaly_reason: 'Developer Mode Active',
    }
  }

  if (ipAnomaly) {
    return {
      anomaly_status: true,
      anomaly_reason: 'IP Address Outside Operational Area',
    }
  }

  return {
    anomaly_status: false,
    anomaly_reason: null,
  }
}

export const lookupIpRegion = async (ipAddress: string): Promise<IpRegionResult> => {
  if (!ipAddress || ipAddress === 'unavailable') {
    return {
      ipAddress: ipAddress || 'unavailable',
      region: null,
      countryCode: null,
    }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 3500)

  try {
    const response = await fetch(`https://ipapi.co/${encodeURIComponent(ipAddress)}/json/`, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      return {
        ipAddress,
        region: null,
        countryCode: null,
      }
    }

    const data = await response.json()

    return {
      ipAddress,
      region: typeof data.region === 'string' ? data.region : null,
      countryCode: typeof data.country_code === 'string' ? data.country_code : null,
    }
  } catch (error) {
    console.warn('IP region lookup failed:', error)
    return {
      ipAddress,
      region: null,
      countryCode: null,
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

export const mergeAnomalyReasons = (
  existingReason?: string | null,
  nextReason?: string | null
) => {
  const reasons = new Set<string>()

  ;[existingReason, nextReason].forEach((value) => {
    if (!value) {
      return
    }

    value.split(',').forEach((reason) => {
      const normalized = reason.trim()
      if (normalized === 'IP Outside Operational Area') {
        reasons.add('IP Address Outside Operational Area')
        return
      }
      if (normalized) {
        reasons.add(normalized)
      }
    })
  })

  const hasDeveloperMode = reasons.has('Developer Mode Active')
  const hasIpOutside = reasons.has('IP Address Outside Operational Area')

  if (hasDeveloperMode && hasIpOutside) {
    return 'Developer Mode Active, IP Outside Operational Area'
  }

  if (hasDeveloperMode) {
    return 'Developer Mode Active'
  }

  if (hasIpOutside) {
    return 'IP Address Outside Operational Area'
  }

  return null
}
