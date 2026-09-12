export const permissionList = [
 'dashboard.view','products.view','products.create','products.edit','products.delete',
 'categories.manage','brands.manage','inventory.view','inventory.adjust','orders.view','orders.update','orders.cancel',
 'customers.view','customers.disable','payments.view','invoices.view','returns.manage','refunds.view','refunds.create',
 'coupons.manage','reviews.moderate','questions.manage','support.manage','content.manage','analytics.view',
 'admins.manage','roles.manage','audit.view','settings.manage','security.view'
] as const;
export const roleDefaults:Record<string,readonly string[]>={
 SUPER_ADMIN:permissionList,
 ADMIN:permissionList.filter(p=>!['admins.manage','roles.manage','settings.manage','security.view'].includes(p)),
 PRODUCT_MANAGER:['products.view','products.create','products.edit','categories.manage','brands.manage'],
 ORDER_MANAGER:['orders.view','orders.update','orders.cancel','invoices.view','returns.manage'],
 INVENTORY_MANAGER:['products.view','inventory.view','inventory.adjust'],
 FINANCE_MANAGER:['payments.view','invoices.view','refunds.view','refunds.create','analytics.view'],
 CUSTOMER_SUPPORT:['orders.view','customers.view','support.manage','questions.manage','returns.manage'],
 CONTENT_MANAGER:['content.manage','reviews.moderate','questions.manage'],
 MARKETING_MANAGER:['coupons.manage','content.manage','analytics.view']
};
export function requiredPermission(resource:string,method='GET',body:Record<string,unknown>={},detail?:string){
 const read=method==='GET'||method==='HEAD';
 switch(resource){
  case 'dashboard':return 'dashboard.view';
  case 'products':return read?'products.view':method==='DELETE'?'products.delete':body.action==='duplicate'||!detail?'products.create':'products.edit';
  case 'images':case 'variants':case 'specifications':return read?'products.view':'products.edit';
  case 'categories':return 'categories.manage';case 'brands':return 'brands.manage';
  case 'inventory':case 'warehouses':case 'transfers':case 'release-reservations':return read?'inventory.view':'inventory.adjust';
  case 'orders':return read?'orders.view':body.status==='CANCELLED'?'orders.cancel':'orders.update';
  case 'customers':return read?'customers.view':'customers.disable';
  case 'payments':return 'payments.view';case 'invoices':return 'invoices.view';
  case 'returns':return 'returns.manage';case 'refunds':return read?'refunds.view':'refunds.create';
  case 'coupons':return 'coupons.manage';case 'reviews':return 'reviews.moderate';case 'questions':return 'questions.manage';case 'support':return 'support.manage';
  case 'banners':case 'blog':case 'homepage':case 'offers':return 'content.manage';
  case 'analytics':case 'reports':return 'analytics.view';
  case 'admin-users':return 'admins.manage';case 'roles':case 'permissions':return 'roles.manage';
  case 'audit-logs':return 'audit.view';case 'security':return 'security.view';
  case 'settings':case 'delivery':case 'outbox':return 'settings.manage';
  case 'notifications':case 'search':return 'authenticated';
  default:return null;
 }
}
export const adminNavigation=[['dashboard','Dashboard'],['products','Products'],['categories','Categories'],['brands','Brands'],['inventory','Inventory'],['warehouses','Warehouses'],['orders','Orders'],['customers','Customers'],['payments','Payments'],['invoices','Invoices'],['returns','Returns'],['refunds','Refunds'],['coupons','Coupons'],['reviews','Reviews'],['questions','Questions & answers'],['support','Support'],['banners','Banners'],['homepage','Homepage content'],['blog','Blog'],['offers','Offers'],['notifications','Notifications'],['reports','Reports'],['analytics','Analytics'],['admin-users','Staff accounts'],['roles','Roles & permissions'],['audit-logs','Audit logs'],['security','Security'],['delivery','Delivery coverage'],['settings','Settings']];
