import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BreadcrumbComponent, BreadcrumbItem } from './breadcrumb.component';

function configure(items: BreadcrumbItem[]): ComponentFixture<BreadcrumbComponent> {
  TestBed.configureTestingModule({
    imports: [BreadcrumbComponent],
    providers: [provideRouter([])],
  });
  const fixture = TestBed.createComponent(BreadcrumbComponent);
  fixture.componentRef.setInput('items', items);
  fixture.detectChanges();
  return fixture;
}

describe('BreadcrumbComponent', () => {
  it('renders nothing when items is empty', () => {
    const fixture = configure([]);
    expect((fixture.nativeElement as HTMLElement).querySelector('.breadcrumb')).toBeNull();
  });

  it('renders every non-last item as a link and the last item as plain text', () => {
    const fixture = configure([{ label: 'Profile', link: ['/profile'] }, { label: 'Followers' }]);
    const compiled: HTMLElement = fixture.nativeElement;

    const link = compiled.querySelector('a');
    expect(link?.textContent).toContain('Profile');
    expect(link?.getAttribute('href')).toBe('/profile');

    const current = compiled.querySelector('.breadcrumb-current');
    expect(current?.textContent).toContain('Followers');
    expect(compiled.querySelectorAll('a')).toHaveLength(1);
  });
});
