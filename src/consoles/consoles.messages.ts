import { CONSOLE_PLATFORM_OPTIONS, ConsoleResponse } from '../curator/curator.models';

export const CONSOLE_NAME_REQUIRED_ERROR = 'Enter a name for this console.';

export const DEVICE_NAME_REQUIRED_ERROR = 'Enter a name for this device.';

export const DEVICE_CAPACITY_REQUIRED_ERROR = 'Enter this device\'s capacity in GB.';

function quotedPlatform(platform: string): string {
  return `"${platform}"`;
}

export const CONSOLE_PLATFORM_ERROR = `platform must be one of ${CONSOLE_PLATFORM_OPTIONS.map((platform) => quotedPlatform(platform)).join(', ')}.`;

export const DEVICE_KIND_ERROR = 'kind must be "m2" or "usb".';

export const CONSOLE_CREATE_ERROR = 'Unable to create this console.';

export const DEVICE_CREATE_ERROR = 'Unable to create this device.';

export function defaultCapacityNoteFor(console: ConsoleResponse): string {
  return `We guessed ${console.raw_capacity_gb} GB for "${console.name}" from its platform/model — edit it below if that's wrong.`;
}
