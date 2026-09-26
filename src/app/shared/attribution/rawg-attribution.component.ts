import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CatalogMetaDirective } from '../../../shared/primitives/typography';
import { ProviderNames } from '../../../shared/provider-names';

export const RAWG_HOME_URL = 'https://rawg.io';

@Component({
  selector: 'app-rawg-attribution',
  imports: [CatalogMetaDirective],
  templateUrl: './rawg-attribution.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RawgAttributionComponent {
  protected readonly rawgHomeUrl = RAWG_HOME_URL;
  protected readonly rawgName = ProviderNames.rawg;
}
