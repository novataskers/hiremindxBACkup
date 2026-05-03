export {
  default,
  sendHireMindXEmailNotification,
  renderHireMindXEmailTemplate,
  getHireMindXNotificationBaseUrl,
} from "@/lib/email";

export type {
  HireMindXEmailNotificationVariant as HireMindXEmailVariant,
  HireMindXEmailNotificationMetadataItem,
  HireMindXEmailNotificationParams as SendHireMindXEmailNotificationParams,
  HireMindXRenderedEmailTemplate,
  HireMindXEmailSendResult,
} from "@/lib/email";
