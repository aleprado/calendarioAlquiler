import { z } from 'zod'

export const socialLinkSchema = z.union([z.string().trim().url('Debe ser una URL válida'), z.literal(null)])
export const optionalTextSchema = z.union([z.string().trim().min(1), z.literal(null)])
export const optionalLatSchema = z.union([z.number().min(-90).max(90), z.literal(null)])
export const optionalLngSchema = z.union([z.number().min(-180).max(180), z.literal(null)])
export const imageUrlListSchema = z.array(z.string().trim().url('Cada imagen debe ser una URL válida')).max(200)
export const instagramPostListSchema = z.array(z.string().trim().url('Cada post de Instagram debe ser una URL válida')).max(6)

export const monthlyRatesSchema = z.record(z.string(), z.number().min(0))
export const exchangeRatesSchema = z
  .object({
    usdToArs: z.number().positive().optional(),
    usdToBrl: z.number().positive().optional(),
  })
  .nullable()

export const timeStringSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Debe tener formato HH:mm (ej: 15:00)')
  .nullable()
  .optional()

export const propertyPayloadSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  airbnbIcalUrl: z.string().url('El enlace de iCal debe ser una URL válida'),
  instagramUrl: socialLinkSchema.optional(),
  googlePhotosUrl: socialLinkSchema.optional(),
  coverImageUrl: socialLinkSchema.optional(),
  description: optionalTextSchema.optional(),
  locationLabel: optionalTextSchema.optional(),
  googleMapsPinUrl: socialLinkSchema.optional(),
  googleMapsPlaceId: optionalTextSchema.optional(),
  googleMapsLat: optionalLatSchema.optional(),
  googleMapsLng: optionalLngSchema.optional(),
  showGoogleReviews: z.boolean().optional(),
  googleMapsReviewsUrl: socialLinkSchema.optional(),
  galleryImageUrls: imageUrlListSchema.optional(),
  instagramPostUrls: instagramPostListSchema.optional(),
  showQuoterPublic: z.boolean().optional(),
  quoterMonthlyRatesUSD: monthlyRatesSchema.optional(),
  quoterAdminCommissionPercent: z.number().min(0).optional(),
  quoterCleaningFeeUSD: z.number().min(0).optional(),
  quoterCustomExchangeRates: exchangeRatesSchema.optional(),
  defaultCheckInTime: timeStringSchema,
  defaultCheckOutTime: timeStringSchema,
})

export const propertyUpdateSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio').optional(),
  airbnbIcalUrl: z.string().url('El enlace de iCal debe ser una URL válida').optional(),
  instagramUrl: socialLinkSchema.optional(),
  googlePhotosUrl: socialLinkSchema.optional(),
  coverImageUrl: socialLinkSchema.optional(),
  description: optionalTextSchema.optional(),
  locationLabel: optionalTextSchema.optional(),
  googleMapsPinUrl: socialLinkSchema.optional(),
  googleMapsPlaceId: optionalTextSchema.optional(),
  googleMapsLat: optionalLatSchema.optional(),
  googleMapsLng: optionalLngSchema.optional(),
  showGoogleReviews: z.boolean().optional(),
  googleMapsReviewsUrl: socialLinkSchema.optional(),
  galleryImageUrls: imageUrlListSchema.optional(),
  instagramPostUrls: instagramPostListSchema.optional(),
  showQuoterPublic: z.boolean().optional(),
  quoterMonthlyRatesUSD: monthlyRatesSchema.optional(),
  quoterAdminCommissionPercent: z.number().min(0).optional(),
  quoterCleaningFeeUSD: z.number().min(0).optional(),
  quoterCustomExchangeRates: exchangeRatesSchema.optional(),
  defaultCheckInTime: timeStringSchema,
  defaultCheckOutTime: timeStringSchema,
  regenerateSlug: z.boolean().optional(),
})

export const propertyJoinSchema = z.object({
  code: z.string().min(1, 'El código es obligatorio'),
})

export const mapResolveSchema = z.object({
  url: z.string().url('La URL debe ser válida'),
})

export const googlePhotosImportSchema = z.object({
  url: z.string().url('La URL del álbum debe ser válida'),
  limit: z.number().int().min(1).max(200).optional(),
})
