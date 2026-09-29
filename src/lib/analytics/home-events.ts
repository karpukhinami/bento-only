import { sendReachGoal } from "./yandex-metrika";

function homeGoal(pathname: string, slug: string, payload: Record<string, unknown> = {}) {
  sendReachGoal(pathname, slug, payload);
}

export function trackHomeFormInputStart(pathname: string, inputName: string) {
  homeGoal(pathname, "aig_form_input_start", { input_name: inputName });
}

export function trackHomeGenerateClick(pathname: string, params: {
  has_source_text: boolean;
  has_attached_images: boolean;
  subject: string;
  grade: string;
  topic_length: number;
}) {
  homeGoal(pathname, "aig_generate_click", params);
}

export function trackHomeContentSuccess(pathname: string, params: {
  entity_count: number;
  has_source_text: boolean;
  generation_mode: "topic_only" | "with_materials";
}) {
  homeGoal(pathname, "aig_content_generation_success", params);
}

export function trackHomeImageSuccess(pathname: string, params: {
  version_number: number;
  image_versions_count: number;
  profile_name: string;
  trigger: "initial" | "regen_image" | "regen_after_edit";
}) {
  homeGoal(pathname, "aig_image_generation_success", params);
}

export function trackHomeRegenContentClick(pathname: string) {
  homeGoal(pathname, "aig_regen_content_click");
}

export function trackHomeRegenContentSuccess(pathname: string, params: {
  entity_count: number;
  has_extra_instructions: boolean;
}) {
  homeGoal(pathname, "aig_regen_content_success", params);
}

export function trackHomeRegenImageClick(pathname: string) {
  homeGoal(pathname, "aig_regen_image_click");
}

export function trackHomeRegenImageSuccess(pathname: string, params: {
  version_number: number;
  profile_name: string;
  has_wishes: boolean;
}) {
  homeGoal(pathname, "aig_regen_image_success", params);
}

export function trackHomeEditModeEnter(pathname: string) {
  homeGoal(pathname, "aig_edit_mode_enter");
}

export function trackHomeEditSave(pathname: string) {
  homeGoal(pathname, "aig_edit_save");
}

export function trackHomeEditSaveAndRegenClick(pathname: string) {
  homeGoal(pathname, "aig_edit_save_and_regen_click");
}

export function trackHomeEditSaveAndRegenSuccess(pathname: string, params: {
  version_number: number;
  has_wishes: boolean;
}) {
  homeGoal(pathname, "aig_edit_save_and_regen_success", params);
}

export function trackHomeImageDownload(pathname: string, params: { version_number: number }) {
  homeGoal(pathname, "aig_image_download", params);
}

export function trackHomeImageFullscreen(pathname: string, params: { version_number: number }) {
  homeGoal(pathname, "aig_image_fullscreen_open", params);
}

export function trackHomeVersionSwitch(pathname: string, params: {
  from_version: number;
  to_version: number;
}) {
  homeGoal(pathname, "aig_version_switch", params);
}

export function trackHomeImageRate(pathname: string, params: {
  version_number: number;
  rating: "like" | "dislike";
}) {
  homeGoal(pathname, "aig_image_rate", params);
}

export function trackHomeResetClick(pathname: string) {
  homeGoal(pathname, "aig_reset_click");
}

export function trackHomeResetConfirm(pathname: string) {
  homeGoal(pathname, "aig_reset_confirm");
}
