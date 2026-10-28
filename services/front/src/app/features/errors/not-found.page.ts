import { Component } from '@angular/core';
import { ErrorState } from '../../ui/states';

@Component({ template: `<tm-error [status]="404" />`, imports: [ErrorState] })
export default class NotFoundPage {}
