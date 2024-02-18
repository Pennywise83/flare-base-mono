import { Routes } from '@angular/router';
import { DataProvidersComponent } from './data-providers.component';

export default [
    { path: '', component: DataProvidersComponent, data: { breadcrumb: { label: 'Data provider' } } }
] as Routes;
