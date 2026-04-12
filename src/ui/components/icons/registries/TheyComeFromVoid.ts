import {groupIconUrls} from '../iconRegistryHelpers';

const icon_modules = import.meta.glob('../assets/TheyComeFromVoid/*.png', {
    import: 'default',
    eager: true,
});

export default groupIconUrls(icon_modules).TheyComeFromVoid || {};
