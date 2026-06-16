export type AnomalyReason =
  | 'IP Address Outside Operational Area'

export type IpRegionResult = {
  ipAddress: string
  region: string | null
  city: string | null
  countryCode: string | null
  network: string | null
}

export type AnomalyEvaluationInput = {
  ipRegion?: string | null
  countryCode?: string | null
  network?: string | null
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
const SUSPICIOUS_NETWORK_KEYWORDS = [
  'vpn',
  'proxy',
  'hosting',
  'host',
  'cloud',
  'data center',
  'datacenter',
  'digitalocean',
  'amazon',
  'aws',
  'google cloud',
  'microsoft',
  'azure',
  'ovh',
  'm247',
  'leaseweb',
  'contabo',
  'choopa',
  'vultr',
  'linode',
]

const normalizeRegion = (value?: string | null) => value?.trim().toLowerCase() || ''
const isSuspiciousNetwork = (network?: string | null) => {
  const normalizedNetwork = normalizeRegion(network)

  if (!normalizedNetwork) {
    return false
  }

  return SUSPICIOUS_NETWORK_KEYWORDS.some((keyword) =>
    normalizedNetwork.includes(keyword)
  )
}

export const isIpOutsideOperationalArea = (
  region?: string | null,
  countryCode?: string | null,
  network?: string | null
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

  if (!isIndonesia) {
    return true
  }

  if (isKepri) {
    return false
  }

  return isSuspiciousNetwork(network)
}

export const evaluateAttendanceAnomaly = ({
  ipRegion,
  countryCode,
  network,
}: AnomalyEvaluationInput): AnomalyEvaluationResult => {
  const ipAnomaly = isIpOutsideOperationalArea(ipRegion, countryCode, network)

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
      city: null,
      countryCode: null,
      network: null,
    }
  }

  const fetchJson = async (url: string) => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3500)

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
        },
      })

      if (!response.ok) {
        return null
      }

      return await response.json()
    } finally {
      clearTimeout(timeoutId)
    }
  }

  try {
    const ipapiData = await fetchJson(
      `https://ipapi.co/${encodeURIComponent(ipAddress)}/json/`
    )

    if (ipapiData?.region || ipapiData?.city || ipapiData?.country_code) {
      return {
        ipAddress,
        region: typeof ipapiData.region === 'string' ? ipapiData.region : null,
        city: typeof ipapiData.city === 'string' ? ipapiData.city : null,
        countryCode:
          typeof ipapiData.country_code === 'string' ? ipapiData.country_code : null,
        network:
          typeof ipapiData.org === 'string'
            ? ipapiData.org
            : typeof ipapiData.asn === 'string'
              ? ipapiData.asn
              : null,
      }
    }

    const ipwhoData = await fetchJson(`https://ipwho.is/${encodeURIComponent(ipAddress)}`)
    return {
      ipAddress,
      region: typeof ipwhoData?.region === 'string' ? ipwhoData.region : null,
      city: typeof ipwhoData?.city === 'string' ? ipwhoData.city : null,
      countryCode:
        typeof ipwhoData?.country_code === 'string' ? ipwhoData.country_code : null,
      network:
        [
          ipwhoData?.connection?.org,
          ipwhoData?.connection?.isp,
          ipwhoData?.connection?.domain,
        ]
          .filter((value) => typeof value === 'string' && value.trim().length > 0)
          .join(' / ') || null,
    }
  } catch (error) {
    console.warn('IP region lookup failed:', error)
    return {
      ipAddress,
      region: null,
      city: null,
      countryCode: null,
      network: null,
    }
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
      if (normalized === 'IP Address Outside Operational Area') {
        reasons.add(normalized)
      }
    })
  })

  const hasIpOutside = reasons.has('IP Address Outside Operational Area')

  if (hasIpOutside) {
    return 'IP Address Outside Operational Area'
  }

  return null
}
