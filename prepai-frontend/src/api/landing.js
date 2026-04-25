import { apiRequest } from './client'

export async function getLandingPageData() {
  return apiRequest('/landing')
}

export async function getFeatures() {
  return apiRequest('/landing/features')
}

export async function getHowItWorks() {
  return apiRequest('/landing/how-it-works')
}

export async function getTestimonials() {
  return apiRequest('/landing/testimonials')
}
