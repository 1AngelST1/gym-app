import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MapaMuscularComponent } from './mapa-muscular.component';

describe('MapaMuscularComponent', () => {
  let component: MapaMuscularComponent;
  let fixture: ComponentFixture<MapaMuscularComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MapaMuscularComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MapaMuscularComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
